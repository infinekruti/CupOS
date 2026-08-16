-- Create wallets table
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create wallet_transactions table
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- positive for top-up, negative for spend
    type TEXT NOT NULL, -- 'top_up', 'spend'
    reference_id TEXT, -- e.g. Razorpay payment ID, or CupOS Order ID
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

-- Policies for wallets (users can read their own wallet)
DROP POLICY IF EXISTS "Users can read own wallet" ON public.wallets;
CREATE POLICY "Users can read own wallet"
    ON public.wallets FOR SELECT
    USING (auth.uid() = user_id);

-- Policies for wallet_transactions (users can read their own transactions)
DROP POLICY IF EXISTS "Users can read own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "Users can read own wallet transactions"
    ON public.wallet_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Allow service role to do everything
DROP POLICY IF EXISTS "Service role full access wallets" ON public.wallets;
CREATE POLICY "Service role full access wallets"
    ON public.wallets FOR ALL
    USING (true)
    WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access wallet_transactions" ON public.wallet_transactions;
CREATE POLICY "Service role full access wallet_transactions"
    ON public.wallet_transactions FOR ALL
    USING (true)
    WITH CHECK (true);
