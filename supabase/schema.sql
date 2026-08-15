-- CupOS V1.0 Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price INTEGER NOT NULL, -- price in paise (₹20 = 2000)
  image_url TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: machines
-- ============================================================
CREATE TABLE IF NOT EXISTS machines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_code TEXT UNIQUE NOT NULL,
  machine_name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'maintenance')),
  last_seen TIMESTAMPTZ,
  firmware_version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: tokens
-- ============================================================
CREATE TABLE IF NOT EXISTS tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL,
  user_id UUID, -- nullable for guest purchases
  product_id UUID NOT NULL REFERENCES products(id),
  order_id TEXT NOT NULL, -- groups multiple tokens from one order
  phone TEXT, -- for SMS recovery
  status TEXT DEFAULT 'UNUSED' CHECK (status IN ('UNUSED', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  redeemed_at TIMESTAMPTZ,
  machine_id UUID REFERENCES machines(id)
);

-- ============================================================
-- TABLE: transactions
-- ============================================================
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id TEXT NOT NULL, -- Razorpay order ID
  payment_id TEXT, -- Razorpay payment ID
  user_id UUID,
  phone TEXT,
  product_ids UUID[] NOT NULL,
  token_ids UUID[] NOT NULL,
  payment_amount INTEGER NOT NULL, -- total in paise
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SEED: Products
-- ============================================================
INSERT INTO products (name, description, price, active) VALUES
  ('Espresso', 'Bold • Strong • Classic', 1500, true),
  ('Cappuccino', 'Smooth • Rich • Perfect', 2000, true),
  ('Latte', 'Creamy • Mild • Comforting', 2000, true),
  ('Hot Chocolate', 'Sweet • Warm • Indulgent', 2000, true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Machines
-- ============================================================
INSERT INTO machines (machine_code, machine_name, location, status) VALUES
  ('INDORE-001', 'Indore Central', 'Indore, MP', 'offline'),
  ('NAGPUR-001', 'Nagpur Hub', 'Nagpur, MH', 'offline')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INDEX: Fast token lookup
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_tokens_token ON tokens(token);
CREATE INDEX IF NOT EXISTS idx_tokens_order_id ON tokens(order_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(status);
CREATE INDEX IF NOT EXISTS idx_machines_code ON machines(machine_code);

-- ============================================================
-- ROW LEVEL SECURITY: tokens (allow service role full access)
-- ============================================================
ALTER TABLE tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;

-- Public read for products
CREATE POLICY "products_public_read" ON products FOR SELECT USING (active = true);

-- Service role can do everything (used by Edge Functions/API routes)
CREATE POLICY "service_role_all_tokens" ON tokens USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_transactions" ON transactions USING (auth.role() = 'service_role');
CREATE POLICY "service_role_all_machines" ON machines USING (auth.role() = 'service_role');
