// Branchements des fonctions sur Supabase (client administrateur, clé « service_role »).
// Utilisé tel quel par Deno (index.ts) et par les tests Node.

export function makeDeps(admin) {
  return {
    async getUser(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (error || !data || !data.user) return null;
      return data.user;
    },
    async consume(userId) {
      const { data, error } = await admin.rpc('ai_consume', { p_user: userId });
      if (error) throw new Error(error.message);
      return data;
    },
    async refund(userId, day) {
      const { error } = await admin.rpc('ai_refund', { p_user: userId, p_day: day });
      if (error) throw new Error(error.message);
    },
    async removeUserFiles(userId) {
      const bucket = admin.storage.from('photos');
      for (let round = 0; round < 50; round++) {
        const { data, error } = await bucket.list(userId, { limit: 1000 });
        if (error) throw new Error(error.message);
        if (!data || !data.length) return;
        const { error: e2 } = await bucket.remove(data.map((o) => `${userId}/${o.name}`));
        if (e2) throw new Error(e2.message);
      }
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error(error.message);
    },
  };
}

export function allowedOriginsFrom(value) {
  return String(value || '*').split(',').map((s) => s.trim()).filter(Boolean);
}
