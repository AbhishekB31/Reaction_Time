-- Manual SQL to add DELETE policies for leaderboard removal
-- Run this in your Supabase SQL Editor

-- Allow anyone to delete participants (this will cascade delete sessions, trials, and summaries)
CREATE POLICY "Anyone can delete participants" ON public.participants FOR DELETE USING (true);

-- Allow anyone to delete sessions (this will cascade delete trials and summaries)
CREATE POLICY "Anyone can delete sessions" ON public.sessions FOR DELETE USING (true);

-- Allow anyone to delete trials
CREATE POLICY "Anyone can delete trials" ON public.trials FOR DELETE USING (true);

-- Allow anyone to delete summaries
CREATE POLICY "Anyone can delete summaries" ON public.summaries FOR DELETE USING (true);
