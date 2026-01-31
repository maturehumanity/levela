-- Enum type for the 5 pillars
CREATE TYPE pillar_type AS ENUM (
  'education_skills',
  'culture_ethics',
  'responsibility_reliability',
  'environment_community',
  'economy_contribution'
);

-- User profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Endorsements table (one user endorsing another on a pillar)
CREATE TABLE public.endorsements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endorser_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endorsed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pillar pillar_type NOT NULL,
  stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment TEXT,
  is_hidden BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Prevent self-endorsement via constraint
  CONSTRAINT no_self_endorsement CHECK (endorser_id != endorsed_id)
);

-- Evidence attachments for endorsements
CREATE TABLE public.evidence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  endorsement_id UUID NOT NULL REFERENCES public.endorsements(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_type TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Reports for moderation
CREATE TABLE public.reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endorsement_id UUID REFERENCES public.endorsements(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.endorsements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Endorsements policies
CREATE POLICY "Non-hidden endorsements are viewable by everyone" ON public.endorsements
  FOR SELECT USING (is_hidden = false OR EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Authenticated users can create endorsements" ON public.endorsements
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (SELECT 1 FROM public.profiles WHERE id = endorser_id AND user_id = auth.uid())
  );

CREATE POLICY "Admins can update endorsements" ON public.endorsements
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Evidence policies
CREATE POLICY "Evidence is viewable with its endorsement" ON public.evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.endorsements e 
      WHERE e.id = endorsement_id AND (e.is_hidden = false OR EXISTS (
        SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true
      ))
    )
  );

CREATE POLICY "Endorsement creator can add evidence" ON public.evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = uploader_id AND user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM public.endorsements e 
      WHERE e.id = endorsement_id AND e.endorser_id = uploader_id
    )
  );

-- Reports policies
CREATE POLICY "Users can create reports" ON public.reports
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = reporter_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can view their own reports" ON public.reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = reporter_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins can update reports" ON public.reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND is_admin = true)
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to call handle_new_user on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to check endorsement cooldown (30 days per pillar per user pair)
CREATE OR REPLACE FUNCTION public.check_endorsement_cooldown()
RETURNS TRIGGER AS $$
DECLARE
  last_endorsement TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT created_at INTO last_endorsement
  FROM public.endorsements
  WHERE endorser_id = NEW.endorser_id
    AND endorsed_id = NEW.endorsed_id
    AND pillar = NEW.pillar
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF last_endorsement IS NOT NULL AND 
     last_endorsement > (now() - INTERVAL '30 days') THEN
    RAISE EXCEPTION 'You can only endorse this user on this pillar once every 30 days. Please wait until %.', 
      last_endorsement + INTERVAL '30 days';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to enforce cooldown
CREATE TRIGGER enforce_endorsement_cooldown
  BEFORE INSERT ON public.endorsements
  FOR EACH ROW
  EXECUTE FUNCTION public.check_endorsement_cooldown();

-- Create index for faster endorsement lookups
CREATE INDEX idx_endorsements_endorsed_id ON public.endorsements(endorsed_id);
CREATE INDEX idx_endorsements_endorser_id ON public.endorsements(endorser_id);
CREATE INDEX idx_endorsements_pillar ON public.endorsements(pillar);
CREATE INDEX idx_profiles_username ON public.profiles(username);