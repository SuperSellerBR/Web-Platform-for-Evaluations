import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';
import { createClient } from 'npm:@supabase/supabase-js@2';
import * as kv from './kv_store.tsx';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger(console.log));

// Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Storage bucket setup
const BUCKET_NAME = 'make-7946999d-files';
const { data: buckets } = await supabase.storage.listBuckets();
const bucketExists = buckets?.some(bucket => bucket.name === BUCKET_NAME);
if (!bucketExists) {
  await supabase.storage.createBucket(BUCKET_NAME, { public: false });
}

// Helper function to verify authentication
async function verifyAuth(request: Request) {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return { error: 'No token provided', user: null };
  }
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  if (error || !user) {
    return { error: 'Unauthorized', user: null };
  }
  return { error: null, user };
}

async function requireAdmin(request: Request) {
  const auth = await verifyAuth(request);
  if (auth.error || !auth.user) return auth;
  const userData = await kv.get(`users:${auth.user.email}`);
  if (!userData || userData.role !== 'admin') {
    return { error: 'Forbidden', user: null };
  }
  return { error: null, user: auth.user };
}

function normalizeRole(raw: any) {
  return (raw || '').toString().trim().toLowerCase();
}

function isCompanyScopedRole(role: string) {
  const normalized = normalizeRole(role);
  return ['empresa', 'company', 'gerente', 'manager', 'vendedor', 'seller'].includes(normalized);
}

function isSellerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === 'vendedor' || normalized === 'seller';
}

function isManagerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === 'gerente' || normalized === 'manager';
}

function isCompanyRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === 'empresa' || normalized === 'company';
}

function isPartnerRole(role: string) {
  const normalized = normalizeRole(role);
  return normalized === 'parceiro' || normalized === 'partner';
}

function isPartnerPortalRole(role: string) {
  const normalized = normalizeRole(role);
  return ['parceiro', 'partner', 'gerente', 'manager', 'vendedor', 'seller'].includes(normalized);
}

function canManagePartnerRole(requesterRole: string, targetRole: string) {
  const requester = normalizeRole(requesterRole);
  const target = normalizeRole(targetRole);
  if (isSellerRole(requester)) return false;
  if (isManagerRole(requester)) return isSellerRole(target);
  if (isCompanyRole(requester)) return isManagerRole(target) || isSellerRole(target);
  return true; // admin/parceiro/etc.
}

function asStringArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((v) => String(v)).filter(Boolean);
  if (typeof val === 'string') return val.split(',').map((v) => v.trim()).filter(Boolean);
  return [];
}

async function requireAuthWithUserData(request: Request) {
  const auth = await verifyAuth(request);
  if (auth.error || !auth.user) {
    return { error: auth.error || 'Unauthorized', user: null, userData: null, role: '', companyId: null };
  }

  const userData = auth.user.email ? await kv.get(`users:${auth.user.email}`) : null;
  const rawRole =
    userData?.role ||
    (auth.user as any).role ||
    (auth.user as any).user_metadata?.role ||
    (auth.user as any).app_metadata?.role ||
    '';
  const role = normalizeRole(rawRole);
  const companyId = (userData?.companyId || '').toString().trim() || null;

  return { error: null, user: auth.user, userData, role, companyId };
}

// ===== AUTH ROUTES =====

// Initial admin signup (no auth required)
app.post('/make-server-7946999d/auth/initial-signup', async (c) => {
  try {
    console.log('=== Initial signup request received ===');
    
    // Check if any users exist
    const existingUsers = await kv.getByPrefix('users:');
    console.log(`Existing users count: ${existingUsers.length}`);
    
    if (existingUsers.length > 0) {
      console.log('Users already exist, blocking initial signup');
      return c.json({ error: 'Sistema já possui usuários cadastrados. Use o login normal.' }, 400);
    }

    const body = await c.req.json();
    const { email, password, name } = body;
    
    console.log(`Creating user - email: ${email}, name: ${name}, password length: ${password?.length}`);
    
    if (!email || !password || !name) {
      console.log('Missing required fields');
      return c.json({ error: 'Email, senha e nome são obrigatórios' }, 400);
    }

    if (password.length < 6) {
      console.log('Password too short');
      return c.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, 400);
    }
    
    console.log('Calling supabase.auth.admin.createUser...');
    console.log(`Using Supabase URL: ${supabaseUrl}`);
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role: 'admin', cpf: '' },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Supabase error creating user: ${JSON.stringify(error)}`);
      return c.json({ error: `Erro do Supabase: ${error.message}` }, 400);
    }

    if (!data?.user) {
      console.log('No user data returned from createUser');
      return c.json({ error: 'Erro ao criar usuário: resposta inválida do Supabase' }, 500);
    }

    console.log(`User created successfully with ID: ${data.user.id}`);

    // Store user data in KV
    try {
      await kv.set(`users:${email}`, {
        id: data.user.id,
        email,
        name,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
      console.log('User data stored in KV successfully');
    } catch (kvError) {
      console.log(`Error storing user in KV: ${JSON.stringify(kvError)}`);
      return c.json({ error: 'Usuário criado mas erro ao salvar dados no banco' }, 500);
    }

    console.log('=== Initial signup completed successfully ===');
    return c.json({ success: true, message: 'Usuário administrador criado com sucesso!' });
  } catch (error) {
    console.log(`Unexpected error during initial signup: ${JSON.stringify(error)}`);
    console.log(`Error stack: ${error.stack}`);
    return c.json({ error: `Erro interno: ${error.message || String(error)}` }, 500);
  }
});

// Sign up
app.post('/make-server-7946999d/auth/signup', async (c) => {
  try {
    const { email, password, name, role, cpf } = await c.req.json();
    
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name, role, cpf },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Error creating user during signup: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Store user data in KV
    await kv.set(`users:${email}`, {
      id: data.user.id,
      email,
      name,
      role,
      cpf,
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, user: data.user });
  } catch (error) {
    console.log(`Unexpected error during signup: ${error}`);
    return c.json({ error: 'Internal server error during signup' }, 500);
  }
});

// Sign in
app.post('/make-server-7946999d/auth/signin', async (c) => {
  try {
    const { email, password } = await c.req.json();
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.log(`Error during sign in: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }

    // Get user data from KV
    const userData = await kv.get(`users:${email}`);

    return c.json({ 
      success: true, 
      accessToken: data.session.access_token,
      user: userData,
    });
  } catch (error) {
    console.log(`Unexpected error during signin: ${error}`);
    return c.json({ error: 'Internal server error during signin' }, 500);
  }
});

// Get current user
app.get('/make-server-7946999d/auth/me', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const userData = await kv.get(`users:${user.email}`);
  return c.json({ user: userData });
});

// ===== COMPANY ROUTES =====

app.post('/make-server-7946999d/companies', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { user, role } = auth;
  if (isCompanyScopedRole(role)) return c.json({ error: 'Forbidden' }, 403);

  try {
    const companyData = await c.req.json();
    const id = crypto.randomUUID();
    
    const company = {
      id,
      ...companyData,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`companies:${id}`, company);
    await kv.set(`companies:index:${id}`, { id, name: company.name });

    return c.json({ success: true, company });
  } catch (error) {
    console.log(`Error creating company: ${error}`);
    return c.json({ error: 'Error creating company' }, 500);
  }
});

app.get('/make-server-7946999d/companies', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const withLogoUrl = async (company: any) => {
      const logoPath = company?.logoPath || company?.logo_path;
      if (!company || !logoPath) return company;
      const signed = await supabase.storage.from(BUCKET_NAME).createSignedUrl(String(logoPath), 60 * 60);
      if (signed.error) return company;
      return { ...company, logoUrl: signed.data?.signedUrl || company.logoUrl };
    };

    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      const company = await kv.get(`companies:${companyId}`);
      const hydrated = company ? await withLogoUrl(company) : null;
      return c.json({ companies: hydrated ? [hydrated] : [] });
    }

    const companies = await kv.getByPrefix('companies:');
    const filteredCompanies = companies
      .filter(item => item.key.startsWith('companies:') && !item.key.includes(':index:'))
      .map(item => item.value);
    
    const hydratedCompanies = await Promise.all(filteredCompanies.map(withLogoUrl));
    return c.json({ companies: hydratedCompanies });
  } catch (error) {
    console.log(`Error fetching companies: ${error}`);
    return c.json({ error: 'Error fetching companies' }, 500);
  }
});

app.get('/make-server-7946999d/companies/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (id !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    const company = await kv.get(`companies:${id}`);
    
    if (!company) {
      return c.json({ error: 'Company not found' }, 404);
    }

    const logoPath = company?.logoPath || company?.logo_path;
    if (!logoPath) return c.json({ company });
    const signed = await supabase.storage.from(BUCKET_NAME).createSignedUrl(String(logoPath), 60 * 60);
    if (signed.error) return c.json({ company });
    return c.json({ company: { ...company, logoUrl: signed.data?.signedUrl || company.logoUrl } });
  } catch (error) {
    console.log(`Error fetching company: ${error}`);
    return c.json({ error: 'Error fetching company' }, 500);
  }
});

app.put('/make-server-7946999d/companies/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (id !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    const updates = await c.req.json();
    const existing = await kv.get(`companies:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Company not found' }, 404);
    }

    const company = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`companies:${id}`, company);
    await kv.set(`companies:index:${id}`, { id, name: company.name });

    return c.json({ success: true, company });
  } catch (error) {
    console.log(`Error updating company: ${error}`);
    return c.json({ error: 'Error updating company' }, 500);
  }
});

app.delete('/make-server-7946999d/companies/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (id !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    await kv.del(`companies:${id}`);
    await kv.del(`companies:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting company: ${error}`);
    return c.json({ error: 'Error deleting company' }, 500);
  }
});

// ===== PARTNER ROUTES =====

app.post('/make-server-7946999d/partners', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { user, role: requesterRole, companyId: requesterCompanyId } = auth;

  try {
    const partnerData = await c.req.json();
    const id = crypto.randomUUID();

    const role = normalizeRole(partnerData.role || 'partner');
    if (!canManagePartnerRole(requesterRole, role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const requestedCompanyId = (partnerData.companyId || '').toString().trim();

    if (isCompanyScopedRole(requesterRole)) {
      if (!requesterCompanyId) {
        return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      }
      if (requestedCompanyId && requestedCompanyId !== requesterCompanyId) {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }

    const companyId = isCompanyScopedRole(requesterRole) ? requesterCompanyId : requestedCompanyId;

    if (isCompanyScopedRole(role)) {
      if (!companyId) {
        return c.json({ error: 'Empresa é obrigatória para este perfil' }, 400);
      }
      const company = await kv.get(`companies:${companyId}`);
      if (!company) {
        return c.json({ error: 'Empresa não encontrada' }, 400);
      }
    }
    
    // Create auth user for partner
    const password = partnerData.cpf.substring(0, 6);
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: partnerData.email,
      password,
      user_metadata: { 
        name: partnerData.name, 
        role: partnerData.role || 'partner',
        cpf: partnerData.cpf,
        companyId: companyId || null,
      },
      email_confirm: true,
    });

    if (authError) {
      console.log(`Error creating partner auth user: ${authError.message}`);
      return c.json({ error: authError.message }, 400);
    }

    const partner = {
      id,
      ...partnerData,
      companyId: companyId || null,
      userId: authData.user.id,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`partners:${id}`, partner);
    await kv.set(`partners:index:${id}`, { id, name: partner.name });
    await kv.set(`users:${partnerData.email}`, {
      id: authData.user.id,
      email: partnerData.email,
      name: partnerData.name,
      role: partnerData.role || 'partner',
      cpf: partnerData.cpf,
      partnerId: id,
      companyId: companyId || null,
      createdAt: new Date().toISOString(),
    });

    return c.json({ success: true, partner });
  } catch (error) {
    console.log(`Error creating partner: ${error}`);
    return c.json({ error: 'Error creating partner' }, 500);
  }
});

app.get('/make-server-7946999d/partners', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    if (isSellerRole(role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const partners = await kv.getByPrefix('partners:');
    const filteredPartners = partners
      .filter(item => item.key.startsWith('partners:') && !item.key.includes(':index:'))
      .map(item => item.value)
      .filter((p) => {
        if (!isCompanyScopedRole(role)) return true;
        if (!companyId) return false;
        return p?.companyId === companyId;
      })
      .filter((p) => {
        if (isManagerRole(role)) return isSellerRole(p?.role || '');
        if (isCompanyRole(role)) return isSellerRole(p?.role || '') || isManagerRole(p?.role || '');
        return true;
      });
    
    return c.json({ partners: filteredPartners });
  } catch (error) {
    console.log(`Error fetching partners: ${error}`);
    return c.json({ error: 'Error fetching partners' }, 500);
  }
});

app.get('/make-server-7946999d/partners/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    const partner = await kv.get(`partners:${id}`);
    
    if (!partner) {
      return c.json({ error: 'Partner not found' }, 404);
    }
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (partner.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    if (isSellerRole(role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (!canManagePartnerRole(role, partner.role || '')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({ partner });
  } catch (error) {
    console.log(`Error fetching partner: ${error}`);
    return c.json({ error: 'Error fetching partner' }, 500);
  }
});

app.put('/make-server-7946999d/partners/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role: requesterRole, companyId: requesterCompanyId } = auth;

  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`partners:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Partner not found' }, 404);
    }
    if (!canManagePartnerRole(requesterRole, existing.role || '')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const normalizedCompanyId =
      (isCompanyScopedRole(requesterRole)
        ? (requesterCompanyId || '')
        : (updates.companyId ?? existing.companyId ?? ''))
        .toString()
        .trim() || null;

    const partner = {
      ...existing,
      ...updates,
      id,
      companyId: normalizedCompanyId,
      updatedAt: new Date().toISOString(),
    };

    if (isCompanyScopedRole(requesterRole)) {
      if (!requesterCompanyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (existing.companyId !== requesterCompanyId) return c.json({ error: 'Forbidden' }, 403);
    }
    if (!canManagePartnerRole(requesterRole, partner.role || '')) {
      return c.json({ error: 'Forbidden' }, 403);
    }

    const role = normalizeRole(partner.role || 'partner');
    if (isCompanyScopedRole(role)) {
      if (!partner.companyId) {
        return c.json({ error: 'Empresa é obrigatória para este perfil' }, 400);
      }
      const company = await kv.get(`companies:${partner.companyId}`);
      if (!company) {
        return c.json({ error: 'Empresa não encontrada' }, 400);
      }
    }

    await kv.set(`partners:${id}`, partner);
    await kv.set(`partners:index:${id}`, { id, name: partner.name });

    // Mantém o usuário do KV em sincronia (para /auth/me e filtros por empresa)
    if (partner.email) {
      const existingUser = await kv.get(`users:${partner.email}`);
      await kv.set(`users:${partner.email}`, {
        ...(existingUser || {}),
        id: existingUser?.id || partner.userId,
        email: partner.email,
        name: partner.name,
        role: partner.role,
        cpf: partner.cpf,
        partnerId: id,
        companyId: partner.companyId || null,
        updatedAt: new Date().toISOString(),
      });
    }

    return c.json({ success: true, partner });
  } catch (error) {
    console.log(`Error updating partner: ${error}`);
    return c.json({ error: 'Error updating partner' }, 500);
  }
});

app.delete('/make-server-7946999d/partners/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    const partner = await kv.get(`partners:${id}`);
    if (!partner) return c.json({ error: 'Partner not found' }, 404);
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (partner.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    if (isSellerRole(role)) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (!canManagePartnerRole(role, partner.role || '')) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    await kv.del(`partners:${id}`);
    await kv.del(`partners:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting partner: ${error}`);
    return c.json({ error: 'Error deleting partner' }, 500);
  }
});

// ===== EVALUATOR ROUTES =====

app.post('/make-server-7946999d/evaluators', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const evaluatorData = await c.req.json();
    const id = crypto.randomUUID();
    
    // Create auth user for evaluator if email provided
    if (evaluatorData.email) {
      const password = crypto.randomUUID().substring(0, 8);
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: evaluatorData.email,
        password,
        user_metadata: { 
          name: evaluatorData.name, 
          role: 'evaluator',
        },
        email_confirm: true,
      });

      if (!authError && authData) {
        evaluatorData.userId = authData.user.id;
        evaluatorData.initialPassword = password;
        
        await kv.set(`users:${evaluatorData.email}`, {
          id: authData.user.id,
          email: evaluatorData.email,
          name: evaluatorData.name,
          role: 'evaluator',
          evaluatorId: id,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const evaluator = {
      id,
      ...evaluatorData,
      score: 0, // Initial score
      totalEvaluations: 0,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`evaluators:${id}`, evaluator);
    await kv.set(`evaluators:index:${id}`, { id, name: evaluator.name });

    return c.json({ success: true, evaluator });
  } catch (error) {
    console.log(`Error creating evaluator: ${error}`);
    return c.json({ error: 'Error creating evaluator' }, 500);
  }
});

app.get('/make-server-7946999d/evaluators', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const evaluators = await kv.getByPrefix('evaluators:');
    const filteredEvaluators = evaluators
      .filter(item => item.key.startsWith('evaluators:') && !item.key.includes(':index:'))
      .map(item => item.value);
    
    return c.json({ evaluators: filteredEvaluators });
  } catch (error) {
    console.log(`Error fetching evaluators: ${error}`);
    return c.json({ error: 'Error fetching evaluators' }, 500);
  }
});

app.get('/make-server-7946999d/evaluators/:id', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const evaluator = await kv.get(`evaluators:${id}`);
    
    if (!evaluator) {
      return c.json({ error: 'Evaluator not found' }, 404);
    }

    return c.json({ evaluator });
  } catch (error) {
    console.log(`Error fetching evaluator: ${error}`);
    return c.json({ error: 'Error fetching evaluator' }, 500);
  }
});

app.put('/make-server-7946999d/evaluators/:id', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`evaluators:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Evaluator not found' }, 404);
    }

    const evaluator = {
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`evaluators:${id}`, evaluator);
    await kv.set(`evaluators:index:${id}`, { id, name: evaluator.name });

    return c.json({ success: true, evaluator });
  } catch (error) {
    console.log(`Error updating evaluator: ${error}`);
    return c.json({ error: 'Error updating evaluator' }, 500);
  }
});

app.delete('/make-server-7946999d/evaluators/:id', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    await kv.del(`evaluators:${id}`);
    await kv.del(`evaluators:index:${id}`);

    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting evaluator: ${error}`);
    return c.json({ error: 'Error deleting evaluator' }, 500);
  }
});

// ===== EVALUATION ROUTES =====

app.post('/make-server-7946999d/evaluations', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { user, role, companyId } = auth;

  try {
    const evaluationData = await c.req.json();
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (evaluationData.companyId && evaluationData.companyId !== companyId) {
        return c.json({ error: 'Forbidden' }, 403);
      }
      evaluationData.companyId = companyId;
    }
    const id = crypto.randomUUID();
    
    const evaluation = {
      id,
      ...evaluationData,
      status: 'scheduled', // scheduled, in_progress, completed, cancelled
      voucherCode: crypto.randomUUID().substring(0, 8).toUpperCase(),
      voucherValidated: false,
      surveyId: evaluationData.surveyId || null,
      createdAt: new Date().toISOString(),
      createdBy: user.id,
    };

    await kv.set(`evaluations:${id}`, evaluation);
    
    // Index by evaluator and company for easy querying
    await kv.set(`evaluations:by_evaluator:${evaluation.evaluatorId}:${id}`, { id });
    await kv.set(`evaluations:by_company:${evaluation.companyId}:${id}`, { id });
    await kv.set(`evaluations:by_voucher:${evaluation.voucherCode}`, { id });

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.log(`Error creating evaluation: ${error}`);
    return c.json({ error: 'Error creating evaluation' }, 500);
  }
});

app.get('/make-server-7946999d/evaluations', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId: scopedCompanyId, userData } = auth;

  try {
    const evaluatorId = c.req.query('evaluatorId');
    const companyId = c.req.query('companyId');
    
    let evaluations = [];
    
    const partnerPortalRole = isPartnerPortalRole(role);
    const sellerRole = isSellerRole(role);
    if (isCompanyScopedRole(role) || partnerPortalRole) {
      if (!scopedCompanyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (companyId && companyId !== scopedCompanyId) return c.json({ error: 'Forbidden' }, 403);

      const keys = await kv.getByPrefix(`evaluations:by_company:${scopedCompanyId}:`);
      const ids = keys.map(k => k.value.id);
      evaluations = await Promise.all(ids.map(id => kv.get(`evaluations:${id}`)));

      if (evaluatorId) {
        evaluations = evaluations.filter((e) => e?.evaluatorId === evaluatorId);
      }
    } else if (evaluatorId) {
      const keys = await kv.getByPrefix(`evaluations:by_evaluator:${evaluatorId}:`);
      const ids = keys.map(k => k.value.id);
      evaluations = await Promise.all(ids.map(id => kv.get(`evaluations:${id}`)));
    } else if (companyId) {
      const keys = await kv.getByPrefix(`evaluations:by_company:${companyId}:`);
      const ids = keys.map(k => k.value.id);
      evaluations = await Promise.all(ids.map(id => kv.get(`evaluations:${id}`)));
    } else {
      const allEvals = await kv.getByPrefix('evaluations:');
      evaluations = allEvals
        .filter(item => item.key.startsWith('evaluations:') && !item.key.includes(':by_'))
        .map(item => item.value);
    }
    
    let filtered = evaluations.filter(e => e !== null);

    // Parceiros: apenas avaliações concluídas (e sempre escopadas à empresa vinculada)
    if (partnerPortalRole) {
      filtered = filtered.filter((e: any) => e?.status === 'completed');
    }

    // Vendedores: apenas avaliações atribuídas ao vendedor
    if (sellerRole) {
      const sellerId = (userData?.partnerId || '').toString().trim();
      if (!sellerId) {
        filtered = [];
      } else {
        const partner = await kv.get(`partners:${sellerId}`);
        const sellerLabels = new Set(
          [sellerId, partner?.name, partner?.email]
            .filter(Boolean)
            .map((v) => String(v).trim().toLowerCase()),
        );

        filtered = filtered.filter((e: any) => {
          const sellers = asStringArray(e?.visitData?.sellers).map((v) => String(v));
          if (sellers.includes(sellerId)) return true;
          const vendors = asStringArray(e?.visitData?.vendors).map((v) => String(v).trim().toLowerCase());
          return vendors.some((v) => sellerLabels.has(v));
        });
      }
    }

    return c.json({ evaluations: filtered });
  } catch (error) {
    console.log(`Error fetching evaluations: ${error}`);
    return c.json({ error: 'Error fetching evaluations' }, 500);
  }
});

app.get('/make-server-7946999d/evaluations/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId, userData } = auth;

  try {
    const id = c.req.param('id');
    const evaluation = await kv.get(`evaluations:${id}`);
    
    if (!evaluation) {
      return c.json({ error: 'Evaluation not found' }, 404);
    }
    const partnerPortalRole = isPartnerPortalRole(role);
    const sellerRole = isSellerRole(role);
    if (isCompanyScopedRole(role) || partnerPortalRole) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }
    if (partnerPortalRole && evaluation.status !== 'completed') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    if (sellerRole) {
      const sellerId = (userData?.partnerId || '').toString().trim();
      if (!sellerId) return c.json({ error: 'Forbidden' }, 403);

      const partner = await kv.get(`partners:${sellerId}`);
      const sellerLabels = new Set(
        [sellerId, partner?.name, partner?.email]
          .filter(Boolean)
          .map((v) => String(v).trim().toLowerCase()),
      );
      const sellers = asStringArray(evaluation?.visitData?.sellers).map((v) => String(v));
      const vendors = asStringArray(evaluation?.visitData?.vendors).map((v) => String(v).trim().toLowerCase());
      const assigned = sellers.includes(sellerId) || vendors.some((v) => sellerLabels.has(v));
      if (!assigned) return c.json({ error: 'Forbidden' }, 403);
    }

    return c.json({ evaluation });
  } catch (error) {
    console.log(`Error fetching evaluation: ${error}`);
    return c.json({ error: 'Error fetching evaluation' }, 500);
  }
});

app.put('/make-server-7946999d/evaluations/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    const updates = await c.req.json();
    const existing = await kv.get(`evaluations:${id}`);
    
    if (!existing) {
      return c.json({ error: 'Evaluation not found' }, 404);
    }

    // Bloqueia alteração do vendedor avaliado (admin apenas, em avaliações concluídas)
    const requestedVisitData = updates?.visitData;
    const wantsSellerChange =
      requestedVisitData &&
      (requestedVisitData.sellers !== undefined || requestedVisitData.vendors !== undefined);
    if (wantsSellerChange) {
      if (role !== 'admin' || existing.status !== 'completed') {
        return c.json({ error: 'Forbidden' }, 403);
      }
    }

    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (existing.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
      if (updates.companyId && updates.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }

    const evaluation = {
      ...existing,
      ...updates,
      id,
      companyId: isCompanyScopedRole(role) ? existing.companyId : (updates.companyId ?? existing.companyId),
      updatedAt: new Date().toISOString(),
    };

    await kv.set(`evaluations:${id}`, evaluation);

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.log(`Error updating evaluation: ${error}`);
    return c.json({ error: 'Error updating evaluation' }, 500);
  }
});

// Admin: alterar vendedor avaliado em avaliação concluída
app.put('/make-server-7946999d/evaluations/:id/evaluated-seller', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role } = auth;

  try {
    if (role !== 'admin') return c.json({ error: 'Forbidden' }, 403);

    const id = c.req.param('id');
    const body = await c.req.json();
    const sellerId = (body?.sellerId || '').toString().trim();
    if (!sellerId) return c.json({ error: 'sellerId obrigatório' }, 400);

    const evaluation = await kv.get(`evaluations:${id}`);
    if (!evaluation) return c.json({ error: 'Evaluation not found' }, 404);
    if (evaluation.status !== 'completed') {
      return c.json({ error: 'Apenas avaliações concluídas podem ser editadas' }, 400);
    }

    const partner = await kv.get(`partners:${sellerId}`);
    if (!partner) return c.json({ error: 'Membro não encontrado' }, 400);
    if (!partner.companyId || partner.companyId !== evaluation.companyId) {
      return c.json({ error: 'Membro não pertence à empresa desta avaliação' }, 400);
    }
    const partnerRole = normalizeRole(partner.role || '');
    if (!['vendedor', 'seller', 'gerente', 'manager'].includes(partnerRole)) {
      return c.json({ error: 'Membro inválido' }, 400);
    }

    const visitData = { ...(evaluation.visitData || {}) } as any;
    visitData.sellers = [sellerId];
    visitData.vendors = partner.name || partner.email || sellerId;

    const updated = {
      ...evaluation,
      visitData,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`evaluations:${id}`, updated);

    return c.json({ success: true, evaluation: updated });
  } catch (error) {
    console.log(`Error updating evaluated seller: ${error}`);
    return c.json({ error: 'Error updating evaluated seller' }, 500);
  }
});

// Find evaluation by voucher code
app.get('/make-server-7946999d/evaluations/by-voucher/:code', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const code = c.req.param('code').toUpperCase();
    let evalRef = await kv.get(`evaluations:by_voucher:${code}`);
    let evaluation = evalRef ? await kv.get(`evaluations:${evalRef.id}`) : null;

    // Fallback: search all evaluations (for legacy records without the index)
    if (!evaluation) {
      const allEvals = await kv.getByPrefix('evaluations:');
      evaluation = allEvals
        .filter(item => item.key.startsWith('evaluations:') && !item.key.includes(':by_'))
        .map(item => item.value)
        .find(e => e?.voucherCode?.toUpperCase() === code);
    }

    if (!evaluation) {
      return c.json({ error: 'Voucher não encontrado' }, 404);
    }
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }

    const company = await kv.get(`companies:${evaluation.companyId}`);
    const evaluator = await kv.get(`evaluators:${evaluation.evaluatorId}`);

    return c.json({ evaluation, company, evaluator });
  } catch (error) {
    console.log(`Error fetching by voucher: ${error}`);
    return c.json({ error: 'Erro ao buscar voucher' }, 500);
  }
});

app.post('/make-server-7946999d/evaluations/:id/validate-voucher', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { user, role, companyId } = auth;

  try {
    const id = c.req.param('id');
    const { managerRating, managerNotes } = await c.req.json();
    const evaluation = await kv.get(`evaluations:${id}`);
    
    if (!evaluation) {
      return c.json({ error: 'Evaluation not found' }, 404);
    }
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }

    evaluation.voucherValidated = true;
    evaluation.voucherValidatedAt = new Date().toISOString();
    evaluation.voucherValidatedBy = user.id;
    evaluation.managerRating = managerRating;
    evaluation.managerNotes = managerNotes;
    evaluation.status = 'in_progress';
    evaluation.updatedAt = new Date().toISOString();

    await kv.set(`evaluations:${id}`, evaluation);

    return c.json({ success: true, evaluation });
  } catch (error) {
    console.log(`Error validating voucher: ${error}`);
    return c.json({ error: 'Error validating voucher' }, 500);
  }
});

// ===== FILE UPLOAD ROUTES =====

app.post('/make-server-7946999d/upload', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as string || 'general';
    
    if (!file) {
      return c.json({ error: 'No file provided' }, 400);
    }

    const isLogoUpload = folder === 'company-logos' || folder.startsWith('company-logos/');
    if (isLogoUpload) {
      if (!file.type?.startsWith('image/')) {
        return c.json({ error: 'Logomarca deve ser uma imagem (PNG/JPG/WEBP)' }, 400);
      }
      if (typeof (file as any).size === 'number' && (file as any).size > 5 * 1024 * 1024) {
        return c.json({ error: 'Imagem muito grande (máx 5MB)' }, 400);
      }
    }

    const fileName = `${folder}/${crypto.randomUUID()}-${file.name}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { data, error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
      });

    if (uploadError) {
      console.log(`Error uploading file: ${uploadError.message}`);
      return c.json({ error: uploadError.message }, 500);
    }

    // Create signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 31536000);

    return c.json({ 
      success: true, 
      path: fileName,
      url: urlData?.signedUrl,
    });
  } catch (error) {
    console.log(`Error in file upload: ${error}`);
    return c.json({ error: 'Error uploading file' }, 500);
  }
});

app.get('/make-server-7946999d/file/:path', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const path = c.req.param('path');
    
    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hour

    if (urlError) {
      console.log(`Error creating signed URL: ${urlError.message}`);
      return c.json({ error: urlError.message }, 500);
    }

    return c.json({ url: urlData.signedUrl });
  } catch (error) {
    console.log(`Error getting file URL: ${error}`);
    return c.json({ error: 'Error getting file URL' }, 500);
  }
});

// ===== MATCHING ALGORITHM =====

app.get('/make-server-7946999d/match-evaluators/:companyId', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId: scopedCompanyId } = auth;

  try {
    const companyId = c.req.param('companyId');
    const allowRepeats = c.req.query('allowRepeats') === 'true';

    if (isCompanyScopedRole(role)) {
      if (!scopedCompanyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (companyId !== scopedCompanyId) return c.json({ error: 'Forbidden' }, 403);
    }
    
    const company = await kv.get(`companies:${companyId}`);
    if (!company) {
      return c.json({ error: 'Company not found' }, 404);
    }

    // Get all evaluators
    const evaluatorsData = await kv.getByPrefix('evaluators:');
    let evaluators = evaluatorsData
      .filter(item => item.key.startsWith('evaluators:') && !item.key.includes(':index:'))
      .map(item => item.value);

    // Filter out evaluators who have already evaluated this company (if not allowing repeats)
    if (!allowRepeats) {
      const companyEvaluations = await kv.getByPrefix(`evaluations:by_company:${companyId}:`);
      const evaluatedEvaluatorIds = new Set();
      
      for (const evalRef of companyEvaluations) {
        const evaluation = await kv.get(`evaluations:${evalRef.value.id}`);
        if (evaluation) {
          evaluatedEvaluatorIds.add(evaluation.evaluatorId);
        }
      }
      
      evaluators = evaluators.filter(e => !evaluatedEvaluatorIds.has(e.id));
    }

    // Calculate match score based on socioeconomic profile
    evaluators = evaluators.map(evaluator => {
      let matchScore = evaluator.score || 0;
      
      // Add matching logic based on socioeconomic profile
      if (company.socioeconomicProfile && evaluator.socioeconomicData) {
        // Simple matching - can be enhanced
        const profileMatch = Object.keys(company.socioeconomicProfile).reduce((score, key) => {
          if (evaluator.socioeconomicData[key] === company.socioeconomicProfile[key]) {
            return score + 10;
          }
          return score;
        }, 0);
        matchScore += profileMatch;
      }

      return { ...evaluator, matchScore };
    });

    // Sort by match score descending
    evaluators.sort((a, b) => b.matchScore - a.matchScore);

    return c.json({ evaluators });
  } catch (error) {
    console.log(`Error matching evaluators: ${error}`);
    return c.json({ error: 'Error matching evaluators' }, 500);
  }
});

// ===== ANALYTICS & REPORTS =====

app.get('/make-server-7946999d/analytics/company/:companyId', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId: scopedCompanyId } = auth;

  try {
    const companyId = c.req.param('companyId');

    if (isCompanyScopedRole(role)) {
      if (!scopedCompanyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (companyId !== scopedCompanyId) return c.json({ error: 'Forbidden' }, 403);
    }
    
    // Get all evaluations for this company
    const evaluationRefs = await kv.getByPrefix(`evaluations:by_company:${companyId}:`);
    const evaluations = await Promise.all(
      evaluationRefs.map(ref => kv.get(`evaluations:${ref.value.id}`))
    );
    
    const completedEvaluations = evaluations.filter(e => e && e.status === 'completed');
    
    // Calculate statistics
    const totalEvaluations = evaluations.length;
    const completedCount = completedEvaluations.length;
    const averageManagerRating = completedEvaluations.reduce((sum, e) => sum + (e.managerRating || 0), 0) / (completedCount || 1);
    
    // Group by period
    const byPeriod = completedEvaluations.reduce((acc, e) => {
      const period = e.period || 'unknown';
      acc[period] = (acc[period] || 0) + 1;
      return acc;
    }, {});

    return c.json({
      totalEvaluations,
      completedCount,
      averageManagerRating,
      byPeriod,
      evaluations: completedEvaluations,
    });
  } catch (error) {
    console.log(`Error fetching analytics: ${error}`);
    return c.json({ error: 'Error fetching analytics' }, 500);
  }
});

// ===== AI ANALYSIS =====

app.post('/make-server-7946999d/analyze-evaluation/:id', async (c) => {
  const auth = await requireAuthWithUserData(c.req.raw);
  if (auth.error || !auth.user) return c.json({ error: 'Unauthorized' }, 401);
  const { role, companyId } = auth;

  try {
    const id = c.req.param('id');
    const evaluation = await kv.get(`evaluations:${id}`);
    
    if (!evaluation) {
      return c.json({ error: 'Evaluation not found' }, 404);
    }
    if (isCompanyScopedRole(role)) {
      if (!companyId) return c.json({ error: 'Usuário sem empresa vinculada' }, 403);
      if (evaluation.companyId !== companyId) return c.json({ error: 'Forbidden' }, 403);
    }

    // Simple analysis based on form responses
    // In a real implementation, this would use an AI API
    const analysis = {
      overallScore: evaluation.formResponses ? 
        Object.values(evaluation.formResponses).reduce((sum: number, val: any) => {
          if (typeof val === 'number') return sum + val;
          return sum;
        }, 0) / Object.keys(evaluation.formResponses).length : 0,
      strengths: ['Atendimento cordial', 'Ambiente limpo'],
      improvements: ['Tempo de espera', 'Conhecimento do produto'],
      summary: `Avaliação ${evaluation.status === 'completed' ? 'completa' : 'pendente'} realizada em ${new Date(evaluation.scheduledDate).toLocaleDateString('pt-BR')}.`,
      generatedAt: new Date().toISOString(),
    };

    // Update evaluation with analysis
    evaluation.aiAnalysis = analysis;
    evaluation.updatedAt = new Date().toISOString();
    await kv.set(`evaluations:${id}`, evaluation);

    return c.json({ success: true, analysis });
  } catch (error) {
    console.log(`Error analyzing evaluation: ${error}`);
    return c.json({ error: 'Error analyzing evaluation' }, 500);
  }
});

// ===== SURVEY BUILDER (CUSTOM FORMS) =====

// Create survey with sections/questions (admin only)
app.post('/make-server-7946999d/surveys', async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, error === 'Forbidden' ? 403 : 401);
  }

  try {
    const payload = await c.req.json();
    const surveyId = crypto.randomUUID();
    const now = new Date().toISOString();

    await supabase.from('surveys').insert({
      id: surveyId,
      title: payload.title,
      description: payload.description || '',
      status: payload.status || 'draft',
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });

    if (Array.isArray(payload.sections)) {
      for (const section of payload.sections) {
        const sectionId = crypto.randomUUID();
        await supabase.from('survey_sections').insert({
          id: sectionId,
          survey_id: surveyId,
          title: section.title || '',
          order: section.order ?? 0,
          weight: section.weight ?? 1,
          scoring_mode: section.scoring_mode || 'soma',
          meta: section.meta || {},
        });

        if (Array.isArray(section.questions)) {
          const rows = section.questions.map((q: any, idx: number) => ({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            section_id: sectionId,
            type: q.type,
            title: q.title,
            description: q.description || '',
            required: !!q.required,
            order: q.order ?? idx,
            config: q.config || {},
            scoring: q.scoring || {},
            logic: q.logic || {},
            created_at: now,
          }));
          if (rows.length) {
            await supabase.from('survey_questions').insert(rows);
          }
        }
      }
    }

    return c.json({ success: true, surveyId });
  } catch (error) {
    console.log(`Error creating survey: ${error}`);
    return c.json({ error: 'Erro ao criar questionário' }, 500);
  }
});

// Get survey with sections/questions
app.get('/make-server-7946999d/surveys/:id', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const id = c.req.param('id');
    const { data: survey } = await supabase.from('surveys').select('*').eq('id', id).maybeSingle();
    if (!survey) return c.json({ error: 'Not found' }, 404);

    const { data: sections } = await supabase
      .from('survey_sections')
      .select('*')
      .eq('survey_id', id)
      .order('order', { ascending: true });

    const { data: questions } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', id)
      .order('order', { ascending: true });

    const grouped = (sections || []).map((s) => ({
      ...s,
      questions: (questions || []).filter((q) => q.section_id === s.id),
    }));

    return c.json({ survey, sections: grouped });
  } catch (error) {
    console.log(`Error fetching survey: ${error}`);
    return c.json({ error: 'Erro ao buscar questionário' }, 500);
  }
});

// List surveys (admin only)
app.get('/make-server-7946999d/surveys', async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, error === 'Forbidden' ? 403 : 401);
  }

  try {
    const { data } = await supabase
      .from('surveys')
      .select('*')
      .order('created_at', { ascending: false });
    return c.json({ surveys: data || [] });
  } catch (error) {
    console.log(`Error listing surveys: ${error}`);
    return c.json({ error: 'Erro ao listar questionários' }, 500);
  }
});

// Delete survey
app.delete('/make-server-7946999d/surveys/:id', async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, error === 'Forbidden' ? 403 : 401);
  }
  try {
    const id = c.req.param('id');
    await supabase.from('survey_questions').delete().eq('survey_id', id);
    await supabase.from('survey_sections').delete().eq('survey_id', id);
    await supabase.from('surveys').delete().eq('id', id);
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting survey: ${error}`);
    return c.json({ error: 'Erro ao excluir questionário' }, 500);
  }
});

// Update survey (replace sections/questions)
app.put('/make-server-7946999d/surveys/:id', async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, error === 'Forbidden' ? 403 : 401);
  }

  try {
    const surveyId = c.req.param('id');
    const payload = await c.req.json();
    const now = new Date().toISOString();

    await supabase.from('surveys')
      .update({
        title: payload.title,
        description: payload.description || '',
        status: payload.status || 'draft',
        updated_at: now,
      })
      .eq('id', surveyId);

    await supabase.from('survey_questions').delete().eq('survey_id', surveyId);
    await supabase.from('survey_sections').delete().eq('survey_id', surveyId);

    if (Array.isArray(payload.sections)) {
      for (const section of payload.sections) {
        const sectionId = crypto.randomUUID();
        await supabase.from('survey_sections').insert({
          id: sectionId,
          survey_id: surveyId,
          title: section.title || '',
          order: section.order ?? 0,
          weight: section.weight ?? 1,
          scoring_mode: section.scoring_mode || 'soma',
          meta: section.meta || {},
        });

        if (Array.isArray(section.questions)) {
          const rows = section.questions.map((q: any, idx: number) => ({
            id: crypto.randomUUID(),
            survey_id: surveyId,
            section_id: sectionId,
            type: q.type,
            title: q.title,
            description: q.description || '',
            required: !!q.required,
            order: q.order ?? idx,
            config: q.config || {},
            scoring: q.scoring || {},
            logic: q.logic || {},
            created_at: now,
          }));
          if (rows.length) {
            await supabase.from('survey_questions').insert(rows);
          }
        }
      }
    }

    return c.json({ success: true, surveyId });
  } catch (error) {
    console.log(`Error updating survey: ${error}`);
    return c.json({ error: 'Erro ao atualizar questionário' }, 500);
  }
});

// Import SurveyMonkey survey by ID (admin)
app.post('/make-server-7946999d/surveys/import', async (c) => {
  const { error, user } = await requireAdmin(c.req.raw);
  if (error || !user) {
    return c.json({ error: error === 'Forbidden' ? 'Forbidden' : 'Unauthorized' }, error === 'Forbidden' ? 403 : 401);
  }

  try {
    const body = await c.req.json();
    const surveyId = body.surveyId;
    const token = body.token;
    if (!surveyId || !token) {
      return c.json({ error: 'Informe surveyId e token do SurveyMonkey' }, 400);
    }

    const smRes = await fetch(`https://api.surveymonkey.com/v3/surveys/${surveyId}/details`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const smData = await smRes.json();
    if (!smRes.ok) {
      return c.json({ error: smData.error || 'Erro ao buscar survey no SurveyMonkey' }, 400);
    }

    const surveyTitle = smData.title || `SurveyMonkey ${surveyId}`;
    const surveyDescription = smData.custom_variables?.description || '';
    const now = new Date().toISOString();
    const newSurveyId = crypto.randomUUID();

    await supabase.from('surveys').insert({
      id: newSurveyId,
      title: surveyTitle,
      description: surveyDescription,
      status: 'draft',
      created_by: user.id,
      created_at: now,
      updated_at: now,
    });

    function mapQuestion(smQ: any, order: number) {
      const family = smQ.family;
      const subtype = smQ.subtype;
      const required = smQ.required || false;
      const heading = smQ.headings?.[0]?.heading || 'Pergunta';
      const description = smQ.headings?.[1]?.heading || '';
      let type = 'text';
      const config: any = {};
      const answers = smQ.answers || {};
      const optsRaw = answers.choices || answers.options || [];
      const opts = Array.isArray(optsRaw) ? optsRaw.map((c: any) => c.text || c.label).filter(Boolean) : [];

      if (family === 'single_choice') {
        type = subtype === 'dropdown' ? 'dropdown' : 'multiple_choice';
        config.options = opts;
        config.allowOther = !!answers.other;
      } else if (family === 'multiple_choice') {
        type = 'checkbox';
        config.options = opts;
        config.allowOther = !!answers.other;
      } else if (family === 'matrix') {
        type = 'matrix';
        config.rows = (answers.rows || []).map((r: any) => r.text).filter(Boolean);
        config.cols = (answers.cols || []).map((r: any) => r.text).filter(Boolean);
      } else if (family === 'rating') {
        type = 'star_rating';
        config.max = answers?.choices?.length || 5;
      } else if (family === 'nps') {
        type = 'nps';
        config.min = 0;
        config.max = 10;
      } else if (family === 'ranking') {
        type = 'ranking';
        config.options = opts;
      } else if (family === 'datetime') {
        type = 'text';
      } else if (family === 'file_upload') {
        type = 'file_upload';
        config.maxSizeMB = 15;
      } else {
        type = 'text';
      }

      return {
        id: crypto.randomUUID(),
        survey_id: newSurveyId,
        section_id: '',
        type,
        title: heading,
        description,
        required,
        order,
        config,
        scoring: { weight: 1 },
        logic: {},
        created_at: now,
      };
    }

    let sectionOrder = 0;
    for (const page of smData.pages || []) {
      const sectionId = crypto.randomUUID();
      await supabase.from('survey_sections').insert({
        id: sectionId,
        survey_id: newSurveyId,
        title: page.title || `Seção ${sectionOrder + 1}`,
        order: sectionOrder,
        weight: 1,
        scoring_mode: 'soma',
        meta: {},
      });
      let qOrder = 0;
      const toInsert: any[] = [];
      for (const q of page.questions || []) {
        const mapped = mapQuestion(q, qOrder);
        mapped.section_id = sectionId;
        toInsert.push(mapped);
        qOrder += 1;
      }
      if (toInsert.length) {
        await supabase.from('survey_questions').insert(toInsert);
      }
      sectionOrder += 1;
    }

    return c.json({ success: true, surveyId: newSurveyId, title: surveyTitle });
  } catch (error) {
    console.log(`Error importing survey: ${error}`);
    return c.json({ error: 'Erro ao importar questionário' }, 500);
  }
});

// Submit survey responses (for evaluator)
app.post('/make-server-7946999d/surveys/:id/responses', async (c) => {
  const { error, user } = await verifyAuth(c.req.raw);
  if (error || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  try {
    const surveyId = c.req.param('id');
    const body = await c.req.json();
    const answers = Array.isArray(body.answers) ? body.answers : [];
    const evaluationId = body.evaluationId || null;
    const now = new Date().toISOString();
    const responseId = crypto.randomUUID();

    const { data: sections } = await supabase
      .from('survey_sections')
      .select('*')
      .eq('survey_id', surveyId);
    const { data: questions } = await supabase
      .from('survey_questions')
      .select('*')
      .eq('survey_id', surveyId);

    const questionMap = new Map((questions || []).map((q) => [q.id, q]));

    const sectionScores: Record<string, { total: number; count: number; mode: string; weight: number }> = {};
    for (const section of sections || []) {
      sectionScores[section.id] = {
        total: 0,
        count: 0,
        mode: section.scoring_mode || 'soma',
        weight: section.weight ?? 1,
      };
    }

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;
      const sectionId = q.section_id;
      const scoring = q.scoring || {};

      let score = 0;
      const weight = scoring.weight ?? 1;

      const type = q.type;
      const val = ans.value;

      const optionScores = scoring.optionScores || {};

      if (type === 'star_rating' || type === 'slider' || type === 'nps') {
        if (typeof val === 'number') score = val * weight;
      } else if (type === 'multiple_choice' || type === 'dropdown') {
        if (typeof val === 'string' && optionScores[val] !== undefined) {
          score = optionScores[val] * weight;
        }
      } else if (type === 'checkbox') {
        if (Array.isArray(val)) {
          for (const v of val) {
            if (optionScores[v] !== undefined) score += optionScores[v] * weight;
          }
        }
      } else if (type === 'matrix') {
        if (val && typeof val === 'object') {
          for (const key of Object.keys(val)) {
            const sel = val[key];
            if (optionScores[key]?.[sel] !== undefined) {
              score += optionScores[key][sel] * weight;
            }
          }
        }
      }

      const sectionScore = sectionScores[sectionId];
      if (sectionScore) {
        sectionScore.total += score;
        sectionScore.count += 1;
      }
    }

    const sectionResults = Object.entries(sectionScores).map(([sectionId, data]) => {
      const base = data.mode === 'media' && data.count > 0 ? data.total / data.count : data.total;
      return { sectionId, score: base * data.weight };
    });

    await supabase.from('survey_responses').insert({
      id: responseId,
      survey_id: surveyId,
      evaluation_id: evaluationId,
      user_id: user.id,
      created_at: now,
      sections_score: sectionResults,
      raw_answers: answers,
    });

    if (answers.length) {
      const answerRows = answers.map((ans: any) => ({
        id: crypto.randomUUID(),
        response_id: responseId,
        question_id: ans.questionId,
        value: ans.value,
      }));
      await supabase.from('survey_answers').insert(answerRows);
    }

    return c.json({ success: true, responseId, sectionResults });
  } catch (error) {
    console.log(`Error submitting survey: ${error}`);
    return c.json({ error: 'Erro ao enviar respostas' }, 500);
  }
});

// Health check
app.get('/make-server-7946999d/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

Deno.serve(app.fetch);
