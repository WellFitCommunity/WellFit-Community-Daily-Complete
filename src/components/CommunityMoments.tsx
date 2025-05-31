import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Confetti from 'react-confetti';
import { motion, AnimatePresence } from 'framer-motion';
import EmojiPicker from 'emoji-picker-react';

const BUCKET = 'community-moments';

interface Affirmation {
  text: string;
  author: string;
}

interface Moment {
  id: string;
  user_id: string;
  file_url: string;
  title: string;
  description: string;
  emoji: string;
  tags: string;
  is_gallery_high: boolean;
  created_at: string;
  profile?: {
    first_name: string;
    last_name: string;
  };
}

const CommunityMoments: React.FC = () => {
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [featured, setFeatured] = useState<Moment[]>([]);
  const [regular, setRegular] = useState<Moment[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [emoji, setEmoji] = useState('');
  const [tags, setTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  // Fetch daily affirmation
  useEffect(() => {
    const fetchAffirmation = async () => {
      const { data } = await supabase.from('affirmations').select('*').order('id', { ascending: true });
      if (data && data.length) {
        const day = new Date().getDate();
        const index = day % data.length;
        setAffirmation(data[index]);
      }
    };
    fetchAffirmation();
  }, []);

  // Fetch moments and split into featured/regular
  useEffect(() => {
    const fetchMoments = async () => {
      let { data } = await supabase
        .from('community_moments')
        .select('*, profile:profiles(user_id, first_name, last_name)')
        .order('created_at', { ascending: false });
      data = data || [];
      setMoments(data);
      setFeatured(data.filter((m: Moment) => m.is_gallery_high));
      setRegular(data.filter((m: Moment) => !m.is_gallery_high));
    };
    fetchMoments();
  }, []);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle emoji selection with animation
  const handleEmojiClick = (emojiObj: any) => {
    setEmoji(emojiObj.emoji);
    setShowEmojiPicker(false);
  };

  // Handle upload
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUploading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user_id = userData?.user?.id;
      if (!user_id) {
        setError('User not authenticated.');
        setUploading(false);
        return;
      }
      if (!selectedFile) {
        setError('Please select a photo to upload.');
        setUploading(false);
        return;
      }

      const filePath = `${user_id}/${Date.now()}_${selectedFile.name}`;
      let { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, selectedFile);

      if (uploadError) {
        setError('File upload failed.');
        setUploading(false);
        return;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from('community_moments')
        .insert([{
          user_id,
          file_url: urlData?.publicUrl || '',
          title,
          description,
          emoji,
          tags,
          is_gallery_high: false, // user cannot set as featured
        }]);

      if (insertError) {
        setError('Failed to save moment.');
        setUploading(false);
        return;
      }

      // Reset form and refresh
      setSelectedFile(null);
      setTitle('');
      setDescription('');
      setEmoji('');
      setTags('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2000);

      // Scroll to top of list on submit
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Refresh list
      const { data: newMoments } = await supabase
        .from('community_moments')
        .select('*, profile:profiles(user_id, first_name, last_name)')
        .order('created_at', { ascending: false });
      const d = newMoments || [];
      setMoments(d);
      setFeatured(d.filter((m: Moment) => m.is_gallery_high));
      setRegular(d.filter((m: Moment) => !m.is_gallery_high));
    } catch (err) {
      setError('Unexpected error.');
    } finally {
      setUploading(false);
    }
  };

  // Scroll to form when needed
  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Emoji animation variants
  const emojiVariants = {
    hidden: { scale: 0, opacity: 0, rotate: -90 },
    visible: { scale: 1.3, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 300 } },
    tap: { scale: 1.6 },
  };

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <Confetti width={window.innerWidth} height={window.innerHeight} numberOfPieces={200} recycle={false} />
        )}
      </AnimatePresence>
      {/* Jazzy Header */}
      <div className="bg-gradient-to-r from-[#003865] to-[#8cc63f] p-5 rounded-t-xl shadow flex flex-col items-center mb-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">🎉</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow">
            Community Moments
          </h1>
          <span className="text-4xl">📸</span>
        </div>
        {affirmation && (
          <motion.div
            className="bg-[#8cc63f] text-white rounded-xl p-4 shadow mt-3 w-full max-w-xl text-center text-xl md:text-2xl font-semibold"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <span className="italic">“{affirmation.text}”</span>
            <div className="text-base font-bold text-white mt-2">
              — {affirmation.author}
            </div>
          </motion.div>
        )}
        <button
          className="mt-6 bg-white text-[#003865] font-bold px-6 py-2 rounded-xl shadow hover:bg-[#8cc63f] hover:text-white text-lg transition"
          onClick={scrollToForm}
        >
          + Share Your Moment
        </button>
      </div>

      {/* Featured Moments */}
      {featured.length > 0 && (
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-3 text-[#8cc63f] flex items-center gap-2">
            <span className="text-2xl">⭐</span> Featured Moments
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map(moment => (
              <div key={moment.id} className="bg-white rounded-xl shadow p-4 flex flex-col items-center border-2 border-[#8cc63f]">
                <img src={moment.file_url} alt={moment.title} className="w-full max-w-xs rounded mb-2" style={{ fontSize: 24 }} />
                <div className="text-2xl font-bold text-[#003865]">{moment.title} {moment.emoji}</div>
                <div className="text-lg text-gray-800">{moment.description}</div>
                {moment.tags && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {moment.tags.split(',').map(tag => (
                      <span key={tag} className="bg-[#8cc63f] text-white px-2 py-0.5 rounded-full text-base">{tag.trim()}</span>
                    ))}
                  </div>
                )}
                <div className="text-sm text-gray-400 mt-2">{moment.profile?.first_name} {moment.profile?.last_name} • {new Date(moment.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Submission Form */}
      <div ref={formRef} className="mb-8 bg-white rounded-xl p-6 shadow border-2 border-[#003865]">
        <h2 className="text-2xl font-bold text-[#003865] mb-2">Share Your Community Moment</h2>
        <form onSubmit={handleSubmit}>
          <label className="block font-semibold mb-1 text-lg">Photo</label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="mb-3 text-lg"
          />
          <label className="block font-semibold mb-1 text-lg">Title</label>
          <input
            className="w-full border rounded p-2 mb-3 text-lg"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={50}
            required
          />
          <label className="block font-semibold mb-1 text-lg">Description</label>
          <textarea
            className="w-full border rounded p-2 mb-3 text-lg"
            placeholder="Share the story or memory behind this moment..."
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            maxLength={240}
            required
          />
          <div className="flex items-center mb-3">
            <label className="font-semibold mr-3 text-lg">Emoji:</label>
            <motion.button
              type="button"
              className="px-3 py-1 border rounded bg-gray-100 text-3xl"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              variants={emojiVariants}
              initial="hidden"
              animate="visible"
              whileTap="tap"
              style={{ fontSize: '2rem' }}
            >
              {emoji || '😊'}
            </motion.button>
            {showEmojiPicker && (
              <div className="z-50 absolute bg-white border rounded shadow mt-2">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  searchDisabled
                  height={350}
                  width={320}
                />
              </div>
            )}
            <span className="text-gray-600 text-base ml-3">Tap to choose an emoji</span>
          </div>
          <label className="block font-semibold mb-1 text-lg">Tags <span className="text-gray-400 text-sm">(comma separated)</span></label>
          <input
            className="w-full border rounded p-2 mb-3 text-lg"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder="fun, family, sunday, event"
            maxLength={60}
          />
          <button
            type="submit"
            disabled={uploading}
            className="bg-[#003865] hover:bg-[#8cc63f] text-white px-6 py-2 rounded-xl font-bold w-full text-xl transition"
          >
            {uploading ? 'Uploading...' : 'Share Moment'}
          </button>
          {error && <p className="text-red-600 text-lg mt-2">{error}</p>}
        </form>
      </div>

      {/* All Moments */}
      <h2 className="text-2xl font-bold mb-3 text-[#003865]">All Community Moments</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {regular.map(moment => (
          <div key={moment.id} className="bg-white rounded-xl shadow p-4 flex flex-col items-center">
            <img src={moment.file_url} alt={moment.title} className="w-full max-w-xs rounded mb-2" style={{ fontSize: 22 }} />
            <div className="text-2xl font-semibold text-[#003865]">{moment.title} {moment.emoji}</div>
            <div className="text-lg text-gray-800">{moment.description}</div>
            {moment.tags && (
              <div className="flex flex-wrap gap-1 mt-1">
                {moment.tags.split(',').map(tag => (
                  <span key={tag} className="bg-gray-300 text-[#003865] px-2 py-0.5 rounded-full text-base">{tag.trim()}</span>
                ))}
              </div>
            )}
            <div className="text-sm text-gray-400 mt-2">{moment.profile?.first_name} {moment.profile?.last_name} • {new Date(moment.created_at).toLocaleString()}</div>
          </div>
        ))}
        {regular.length === 0 && (
          <div className="text-gray-400 text-center text-xl py-8 col-span-full">No moments shared yet.</div>
        )}
      </div>
    </div>
  );
};

export default CommunityMoments;
