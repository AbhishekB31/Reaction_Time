-- Create participants table
CREATE TABLE public.participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) >= 2 AND char_length(name) <= 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_participants_name ON public.participants(name);

-- Create sessions table
CREATE TABLE public.sessions (
  id TEXT NOT NULL PRIMARY KEY,
  participant_id UUID NOT NULL REFERENCES public.participants(id) ON DELETE CASCADE,
  consent_given INTEGER NOT NULL DEFAULT 0 CHECK (consent_given IN (0, 1)),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  user_agent TEXT,
  screen_w INTEGER,
  screen_h INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sessions_participant ON public.sessions(participant_id);
CREATE INDEX idx_sessions_completed ON public.sessions(completed);

-- Create trials table
CREATE TABLE public.trials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  trial_index INTEGER NOT NULL DEFAULT 1,
  rt_ms_raw REAL NOT NULL,
  rt_ms_clean REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trials_session ON public.trials(session_id);

-- Create summaries table
CREATE TABLE public.summaries (
  session_id TEXT NOT NULL PRIMARY KEY REFERENCES public.sessions(id) ON DELETE CASCADE,
  best_ms REAL NOT NULL,
  median_ms REAL NOT NULL,
  mean_ms REAL NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (public stats page should be accessible to everyone)
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (as per privacy requirements, names and stats are public)
CREATE POLICY "Anyone can read participants" ON public.participants FOR SELECT USING (true);
CREATE POLICY "Anyone can read sessions" ON public.sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can read trials" ON public.trials FOR SELECT USING (true);
CREATE POLICY "Anyone can read summaries" ON public.summaries FOR SELECT USING (true);

-- Create policies for insert (anyone can create a new participant/session)
CREATE POLICY "Anyone can insert participants" ON public.participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert sessions" ON public.sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert trials" ON public.trials FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can insert summaries" ON public.summaries FOR INSERT WITH CHECK (true);

-- Create policies for update (allow updates to sessions and summaries)
CREATE POLICY "Anyone can update sessions" ON public.sessions FOR UPDATE USING (true);
CREATE POLICY "Anyone can update summaries" ON public.summaries FOR UPDATE USING (true);