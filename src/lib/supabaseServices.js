import { supabase } from './supabase';

const BUCKET = 'videos';

export async function getStudents(userId) {
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addStudent(userId, { name, email, phone, notes = '' }) {
  if (!supabase || !userId) throw new Error('Not authenticated');
  const { data, error } = await supabase
    .from('students')
    .insert({ user_id: userId, name, email, phone, notes })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudent(id, { name, email, phone }) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('students')
    .update({ name, email, phone })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateStudentNotes(id, notes) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase
    .from('students')
    .update({ notes })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteStudent(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { error } = await supabase.from('students').delete().eq('id', id);
  if (error) throw error;
}

export async function getVideosByStudent(studentId) {
  if (!supabase || !studentId) return [];
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getVideoPublicUrl(storagePath) {
  if (!supabase) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}

export async function uploadVideo(userId, studentId, file, label) {
  if (!supabase || !userId) throw new Error('Not authenticated');
  const ext = file.name.split('.').pop() || 'mp4';
  const path = `${userId}/${studentId}/${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (uploadError) throw uploadError;

  const date = new Date().toLocaleDateString();
  const { data, error } = await supabase
    .from('videos')
    .insert({
      user_id: userId,
      student_id: studentId,
      label,
      date,
      storage_path: path,
    })
    .select()
    .single();

  if (error) throw error;
  return { ...data, url: await getVideoPublicUrl(path) };
}

export async function deleteVideo(id) {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: row } = await supabase.from('videos').select('storage_path').eq('id', id).single();
  if (row?.storage_path) {
    await supabase.storage.from(BUCKET).remove([row.storage_path]);
  }
  const { error } = await supabase.from('videos').delete().eq('id', id);
  if (error) throw error;
}
