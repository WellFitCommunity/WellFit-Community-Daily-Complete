import * as React from 'react';
import { useState, useEffect } from 'react';
import { useSupabaseClient } from '../../contexts/AuthContext';

const techTips: string[] = [
  // Part 1 - Security & Scams
  "🔒 Don't share your password or PIN. Keep your secret numbers safe. Only you should know them.",
  "💸 Never send money to strangers on CashApp or Zelle. Call someone you trust if you're unsure.",
  "🚫 Don't click links in strange texts or emails. If you didn't ask for it, don't tap it.",
  "📵 If it feels wrong, hang up. Real companies will not rush or scare you.",
  "📸 Don't share pictures of your ID, checks, or cards. Keep your private info safe.",
  "🕵️‍♂️ If someone says they're from Medicare or Social Security, hang up and call the real number.",
  "👂 Don't say 'yes' to strange callers. Some scams record your voice.",
  "🔐 Use a passcode on your phone. It keeps your info safe if you lose it.",
  "🎯 Real banks will never ask for your password over the phone or email.",
  "🚨 If your screen says it's locked or hacked, don't click anything. Turn it off and call for help.",

  // Part 2 - Phone Maintenance & Performance  
  "🔁 Turn your phone off once a week. Wait 5 minutes, then turn it back on. It helps your phone run better.",
  "🔋 Keep your phone charged above 20%. Low battery makes your phone act funny or shut off.",
  "📶 Move around if your phone is acting up. Go near a window for better signal.",
  "🔄 Update your phone when it asks. Updates fix problems and add protection.",
  "🧹 Clear out old apps you don't use. This makes your phone faster.",
  "🔁 Restart apps that freeze or act funny. Close them and reopen.",
  "📤 Back up your photos to the cloud or an email account.",
  "🔧 If your phone is slow, try closing all open apps and restarting.",
  "🌡️ Don't leave your phone in hot cars or cold weather - it can damage the battery.",
  "🔌 Unplug your phone when it reaches 100%. Overcharging can hurt the battery.",

  // Part 3 - Smart Usage Tips
  "👀 Use big text on your phone. It helps you see better and avoid mistakes.",
  "🛑 Don't answer unknown calls. If it's important, they'll leave a message.",
  "🔎 Ask someone you trust before downloading a new app.",
  "🎤 Cover your camera or mic if you're not using it. It adds extra privacy.",
  "📴 Silence unknown numbers in your phone settings to avoid spam calls.",
  "📲 Always use Wi-Fi at home instead of phone data—it's cheaper and faster.",
  "📥 Check app reviews before downloading. Look for 4 stars or more.",
  "📅 Set reminders on your phone for pills or appointments.",
  "🗂️ Save important phone numbers in your Contacts so you don't forget.",
  "🔊 Turn up your ringtone volume so you don't miss important calls.",

  // Part 4 - Internet & Social Media Safety
  "🌐 Don't believe everything you see online. Some stories and pictures are fake.",
  "🖼️ Be careful when sharing photos. Some apps post to the public by default.",
  "👩‍⚕️ Don't share health info with strangers online. Keep it private.",
  "💬 Be careful what you post - once it's online, it stays online forever.",
  "👥 Only accept friend requests from people you actually know.",
  "🔍 Before sharing news stories, check if they're real on a trusted news site.",
  "🎪 Be suspicious of 'too good to be true' deals online.",
  "🏪 Only shop on websites that start with 'https://' - the 's' means secure.",
  "📧 Don't open email attachments from people you don't know.",
  "🔒 Log out of important accounts when you're done using them.",

  // Part 5 - Health & Emergency Features
  "🆘 Learn how to use Emergency SOS on your phone - hold power button and volume up.",
  "📍 Turn on location sharing with trusted family members for safety.",
  "💊 Use your phone's built-in medication reminders.",
  "👨‍⚕️ Store your emergency contacts and medical info in your phone.",
  "🚑 Learn your address by heart in case you need to tell 911 dispatchers.",
  "🔦 Your phone has a flashlight - swipe down and tap the flashlight icon.",
  "📞 Program ICE (In Case of Emergency) contacts in your phone.",
  "🩺 Use health apps to track blood pressure, steps, or medications.",
  "⏰ Set multiple alarms for important things like taking medicine.",
  "🌙 Use Do Not Disturb mode at night so only emergency calls come through.",

  // Part 6 - Getting Help & Learning
  "🔍 Use Google or YouTube to find how-to videos for common questions.",
  "🧑‍💻 Ask a grandchild or friend to help you with settings you don't understand.",
  "📚 Many libraries offer free tech help classes for seniors.",
  "📞 Call the phone company if you're having trouble - they want to help.",
  "🎓 Start with one new feature at a time. Don't try to learn everything at once.",
  "📝 Write down steps for things you use often, like checking email.",
  "👨‍🏫 Apple and Android stores often have free classes for seniors.",
  "🤝 Find a tech buddy who can answer questions when you're stuck.",
  "💡 YouTube has simple tutorials for almost any phone question.",
  "🎯 Practice new features when you're not in a hurry or stressed.",

  // Part 7 - Money & Shopping Safety
  "💳 Never give credit card numbers over the phone unless you called them first.",
  "🛍️ Check your bank account regularly to spot weird charges quickly.",
  "🎁 Be extra careful during holidays - scammers work harder then.",
  "📦 If you didn't order it, don't pay for shipping to 'return' it.",
  "💰 Real prizes don't require you to pay fees or taxes first.",
  "🏦 Use your bank's official app instead of clicking links in emails.",
  "💸 Set up account alerts to know when money goes in or out.",
  "🛡️ Use secure payment methods like PayPal when shopping online.",
  "📊 Check your credit report once a year for free at annualcreditreport.com.",
  "💳 Report lost cards immediately - most banks have 24/7 phone lines.",

  // Part 8 - Communication & Contacts
  "📱 Learn how to make your text bigger so it's easier to read.",
  "📢 Use voice-to-text instead of typing - just tap the microphone.",
  "📷 Take photos of important documents and store them on your phone.",
  "👨‍👩‍👧‍👦 Set up group chats with family to stay in touch easily.",
  "🔔 Choose different ringtones for important people so you know who's calling.",
  "📧 Check your email regularly but don't feel pressured to respond immediately.",
  "💬 Learn the difference between text messages and data messages.",
  "📞 Speed dial your most important numbers for quick access.",
  "🎤 Use speaker phone when your hands are busy or you can't hold the phone.",
  "📝 Keep a written backup of important phone numbers in case your phone breaks."
];

interface TipFeedback {
  date: string;
  reaction: 'helpful' | 'not-helpful';
  timestamp: number;
}

const TechTip: React.FC = () => {
  const supabase = useSupabaseClient();
  const [feedback, setFeedback] = useState<TipFeedback | null>(null);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  // Calculate today's tip index (cycles through all tips)
  const getTodaysTipIndex = (): number => {
    const today = new Date();
    const daysSinceEpoch = Math.floor(today.getTime() / (1000 * 60 * 60 * 24));
    return daysSinceEpoch % techTips.length;
  };

  const todaysTipIndex = getTodaysTipIndex();
  const todaysDateString = new Date().toDateString();

  // Load saved feedback for today's tip
  useEffect(() => {
    const savedFeedback = localStorage.getItem(`tip-feedback-${todaysDateString}`);
    if (savedFeedback) {
      setFeedback(JSON.parse(savedFeedback));
    } else {
      setFeedback(null);
    }
  }, [todaysDateString]);

  const handleFeedback = async (reaction: 'helpful' | 'not-helpful') => {
    const newFeedback: TipFeedback = {
      date: todaysDateString,
      reaction,
      timestamp: Date.now()
    };

    setFeedback(newFeedback);
    setShowFeedback(true);

    // Save to localStorage using today's date as key
    localStorage.setItem(`tip-feedback-${todaysDateString}`, JSON.stringify(newFeedback));

    // Log engagement to database for admin panel tracking
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('user_engagements').insert({
          user_id: user.id,
          engagement_type: 'tech_tip_feedback',
          content_id: `tip-${todaysTipIndex}`,
          metadata: {
            tip_content: todaysTip,
            reaction: reaction,
            date: todaysDateString
          }
        });
      }
    } catch (error) {
      console.error('Failed to log tech tip engagement:', error);
    }

    // Hide feedback message after 3 seconds
    setTimeout(() => {
      setShowFeedback(false);
    }, 3000);
  };

  const todaysTip = techTips[todaysTipIndex];

  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md relative overflow-hidden">
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-blue-400/10 via-green-400/10 to-blue-400/10 animate-pulse pointer-events-none"></div>

      {/* Content */}
      <div className="relative z-10">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-wellfit-blue mb-1 flex items-center">
          <span className="mr-2 text-2xl animate-bounce">💡</span>
          Tech Tip of the Day
        </h2>
        <p className="text-sm text-gray-500">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      {/* Tip Content with enhanced glow */}
      <div className="bg-gradient-to-r from-blue-50 to-green-50 p-5 rounded-lg mb-5 border-l-4 border-wellfit-blue shadow-lg ring-2 ring-blue-200/50 hover:ring-blue-300/70 transition-all duration-300">
        <p className="text-gray-800 text-lg leading-relaxed">{todaysTip}</p>
      </div>

      {/* Feedback Section */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-600 mb-3 text-center">
          Was today's tip helpful?
        </p>
        
        {!feedback ? (
          <div className="flex justify-center space-x-3">
            <button
              onClick={() => handleFeedback('helpful')}
              className="flex items-center space-x-2 px-6 py-3 bg-white border-2 border-green-300 rounded-lg hover:bg-green-50 hover:border-green-400 transition-all duration-200 shadow-sm"
            >
              <span className="text-2xl">👍</span>
              <span className="font-medium text-green-700">Helpful</span>
            </button>

            <button
              onClick={() => handleFeedback('not-helpful')}
              className="flex items-center space-x-2 px-6 py-3 bg-white border-2 border-red-300 rounded-lg hover:bg-red-50 hover:border-red-400 transition-all duration-200 shadow-sm"
            >
              <span className="text-2xl">👎</span>
              <span className="font-medium text-red-700">Not helpful</span>
            </button>
          </div>
        ) : (
          <div className={`text-center p-3 rounded-lg ${
            feedback.reaction === 'helpful' 
              ? 'bg-green-100 border border-green-300' 
              : 'bg-red-100 border border-red-300'
          }`}>
            <div className="flex justify-center items-center space-x-2">
              <span className="text-2xl">
                {feedback.reaction === 'helpful' ? '👍' : '👎'}
              </span>
              <span className={`font-medium ${
                feedback.reaction === 'helpful' ? 'text-green-700' : 'text-red-700'
              }`}>
                You marked this tip as {feedback.reaction === 'helpful' ? 'helpful' : 'not helpful'}
              </span>
            </div>
          </div>
        )}

        {/* Feedback confirmation message */}
        {showFeedback && (
          <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center animate-pulse">
            <p className="text-sm text-blue-700 font-medium">
              ✨ Thank you for your feedback! Come back tomorrow for a new tip.
            </p>
          </div>
        )}
      </div>

      {/* Bottom info */}
      <div className="mt-4 text-center">
        <p className="text-xs text-gray-400">
          💡 New tip every day • Check back tomorrow for more!
        </p>
      </div>
      </div>
    </section>
  );
};

export default TechTip;