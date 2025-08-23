import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

type Props = {
  momentId: string;
  isFeatured: boolean;
  onChanged?: (next: boolean) => void;
};

const AdminFeatureToggle: React.FC<Props> = ({ momentId, isFeatured, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>('');

  const flip = async () => {
    try {
      setBusy(true);
      setErr('');
      const next = !isFeatured;
      const { data, error } = await supabase
        .from('community_moments')
        .update({ is_gallery_high: next })
        .eq('id', momentId)
        .select('id, is_gallery_high')
        .single();
      if (error) throw error;
      onChanged?.(Boolean(data?.is_gallery_high));
    } catch (e: any) {
      setErr(e?.message || 'Update failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col items-center">
      <button
        type="button"
        onClick={flip}
        disabled={busy}
        className={`px-3 py-1 rounded-lg text-sm font-semibold ${
          isFeatured
            ? 'bg-[#8cc63f] text-white hover:opacity-90'
            : 'bg-white text-[#003865] border border-[#003865] hover:bg-[#8cc63f] hover:text-white'
        }`}
        aria-label={isFeatured ? 'Unfeature this moment' : 'Feature this moment'}
      >
        {busy ? 'Saving…' : isFeatured ? 'Unfeature' : 'Feature'}
      </button>
      {err && <div className="text-red-600 text-sm mt-1">{err}</div>}
    </div>
  );
};

export default AdminFeatureToggle;
