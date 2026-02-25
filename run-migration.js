#!/usr/bin/env node

/**
 * Migration Runner - Execute migration-wordpress-integration.sql
 * Usage: node run-migration.js
 * 
 * This script reads the migration file and provides instructions
 * to execute it in Supabase console
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load .env.local manually
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error('❌ Error: .env.local not found');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const env = {};

  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    const [key, ...valueParts] = trimmed.split('=');
    env[key] = valueParts.join('=');
  });

  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0]?.split('https://')[1];

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function executeMigration() {
  try {
    console.log('');
    console.log('🚀 Starting WordPress Migration');
    console.log('═══════════════════════════════════════');
    console.log('');

    console.log('🔄 Reading migration file...');
    const migrationPath = path.join(__dirname, 'migration-wordpress-integration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Error: migration-wordpress-integration.sql not found');
      process.exit(1);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    console.log('✅ Migration file read successfully');
    
    console.log('');
    console.log('🔄 Executing migration via Supabase API...');
    console.log(`   Project: ${projectRef}`);
    console.log('');

    // Execute the migration via Supabase REST API
    const result = await executeSQL(supabaseUrl, supabaseKey, migrationSQL);

    if (result.success) {
      console.log('');
      console.log('═══════════════════════════════════════');
      console.log('🎉 Migration completed successfully!');
      console.log('═══════════════════════════════════════');
      console.log('');
      console.log('✅ WordPress tables have been created:');
      console.log('   - oauth_states');
      console.log('   - wordpress_connections');
      console.log('   - articles (updated with WordPress columns)');
      console.log('');
      console.log('You can now use the WordPress integration!');
      console.log('');
      process.exit(0);
    } else {
      throw new Error(result.error);
    }
  } catch (err) {
    console.error('');
    console.error('❌ Migration Error:', err.message);
    console.error('');
    console.error('📝 Alternative: Manual Migration via Supabase Console');
    console.error('═══════════════════════════════════════');
    console.error('');
    console.error('1. Go to: https://supabase.com/dashboard');
    console.error('2. Select your project');
    console.error('3. Click "SQL Editor" in the left sidebar');
    console.error('4. Click "New Query"');
    console.error('5. Open: migration-wordpress-integration.sql');
    console.error('6. Copy all the contents');
    console.error('7. Paste into the SQL Editor');
    console.error('8. Click "Run"');
    console.error('');
    process.exit(1);
  }
}

function executeSQL(supabaseUrl, serviceRoleKey, sql) {
  return new Promise((resolve, reject) => {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;

    // Remove comments and trim
    const cleanedSQL = sql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');

    const options = {
      hostname: hostname,
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          console.log('✅ Migration executed successfully');
          resolve({ success: true });
        } else if (res.statusCode === 404) {
          // RPC function doesn't exist, provide manual instructions
          console.log('⚠️  Supabase RPC endpoint not available');
          console.log('   You\'ll need to run the migration manually');
          resolve({ success: false, error: 'RPC endpoint not available' });
        } else {
          try {
            const error = JSON.parse(data);
            reject(new Error(error.message || `HTTP ${res.statusCode}`));
          } catch {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        }
      });
    });

    req.on('error', reject);

    req.write(JSON.stringify({ sql: cleanedSQL }));
    req.end();
  });
}

// Run the migration
executeMigration();
