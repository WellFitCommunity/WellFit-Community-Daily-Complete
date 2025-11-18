// ============================================================================
// Personalized Greeting - Positive Daily Affirmations
// ============================================================================
// Purpose: Greet healthcare workers, admins, and staff with personalized
//          messages and inspirational quotes from great leaders
// Design: Show user's name, role, time of day, and rotating daily quote
// ============================================================================

import React, { useMemo } from 'react';

interface PersonalizedGreetingProps {
  userName?: string;
  userRole?: string;
  hideForSeniors?: boolean; // Seniors already have their own greeting
}

// Inspirational quotes from notable leaders and thought leaders
const INSPIRATIONAL_QUOTES = [
  {
    quote: "The best way to find yourself is to lose yourself in the service of others.",
    author: "Mahatma Gandhi"
  },
  {
    quote: "Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.",
    author: "Martin Luther King Jr."
  },
  {
    quote: "You can't use up creativity. The more you use, the more you have.",
    author: "Maya Angelou"
  },
  {
    quote: "There is no greater agony than bearing an untold story inside you.",
    author: "Maya Angelou"
  },
  {
    quote: "I've learned that people will forget what you said, people will forget what you did, but people will never forget how you made them feel.",
    author: "Maya Angelou"
  },
  {
    quote: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.",
    author: "Martin Luther King Jr."
  },
  {
    quote: "The time is always right to do what is right.",
    author: "Martin Luther King Jr."
  },
  {
    quote: "Ask not what your country can do for you – ask what you can do for your country.",
    author: "John F. Kennedy"
  },
  {
    quote: "Change is the law of life. And those who look only to the past or present are certain to miss the future.",
    author: "John F. Kennedy"
  },
  {
    quote: "Efforts and courage are not enough without purpose and direction.",
    author: "John F. Kennedy"
  },
  {
    quote: "Be the change that you wish to see in the world.",
    author: "Mahatma Gandhi"
  },
  {
    quote: "In a gentle way, you can shake the world.",
    author: "Mahatma Gandhi"
  },
  {
    quote: "The future belongs to those who believe in the beauty of their dreams.",
    author: "Eleanor Roosevelt"
  },
  {
    quote: "No one can make you feel inferior without your consent.",
    author: "Eleanor Roosevelt"
  },
  {
    quote: "You must do the things you think you cannot do.",
    author: "Eleanor Roosevelt"
  },
  {
    quote: "If your actions inspire others to dream more, learn more, do more and become more, you are a leader.",
    author: "John Quincy Adams"
  },
  {
    quote: "Don't wait for opportunity. Create it.",
    author: "George Bernard Shaw"
  },
  {
    quote: "The only impossible journey is the one you never begin.",
    author: "Tony Robbins"
  },
  {
    quote: "Believe you can and you're halfway there.",
    author: "Theodore Roosevelt"
  },
  {
    quote: "It is during our darkest moments that we must focus to see the light.",
    author: "Aristotle"
  },
  {
    quote: "The only way to do great work is to love what you do.",
    author: "Steve Jobs"
  },
  {
    quote: "Nothing can stop the man with the right mental attitude from achieving his goal.",
    author: "Thomas Jefferson"
  },
  {
    quote: "Your work is going to fill a large part of your life, and the only way to be truly satisfied is to do what you believe is great work.",
    author: "Steve Jobs"
  },
  {
    quote: "Challenges are what make life interesting and overcoming them is what makes life meaningful.",
    author: "Joshua J. Marine"
  },
  {
    quote: "If you look at what you have in life, you'll always have more. If you look at what you don't have in life, you'll never have enough.",
    author: "Oprah Winfrey"
  },
  {
    quote: "The greatest glory in living lies not in never falling, but in rising every time we fall.",
    author: "Nelson Mandela"
  },
  {
    quote: "Education is the most powerful weapon which you can use to change the world.",
    author: "Nelson Mandela"
  },
  {
    quote: "It always seems impossible until it's done.",
    author: "Nelson Mandela"
  },
  {
    quote: "You don't have to see the whole staircase, just take the first step.",
    author: "Martin Luther King Jr."
  },
  {
    quote: "Life is what happens when you're busy making other plans.",
    author: "John Lennon"
  },
  {
    quote: "The purpose of our lives is to be happy.",
    author: "Dalai Lama"
  },
  {
    quote: "Get busy living or get busy dying.",
    author: "Stephen King"
  },
  {
    quote: "You only live once, but if you do it right, once is enough.",
    author: "Mae West"
  },
  {
    quote: "Success is not final, failure is not fatal: it is the courage to continue that counts.",
    author: "Winston Churchill"
  },
  {
    quote: "When you reach the end of your rope, tie a knot in it and hang on.",
    author: "Franklin D. Roosevelt"
  },
  {
    quote: "The best time to plant a tree was 20 years ago. The second best time is now.",
    author: "Chinese Proverb"
  },
  {
    quote: "Your limitation—it's only your imagination.",
    author: "Unknown"
  },
  {
    quote: "Great things never come from comfort zones.",
    author: "Unknown"
  },
  {
    quote: "Don't stop when you're tired. Stop when you're done.",
    author: "Unknown"
  },
  {
    quote: "Wake up with determination. Go to bed with satisfaction.",
    author: "Unknown"
  },
  {
    quote: "Do something today that your future self will thank you for.",
    author: "Sean Patrick Flanery"
  },
  {
    quote: "Little things make big days.",
    author: "Unknown"
  },
  {
    quote: "It's going to be hard, but hard does not mean impossible.",
    author: "Unknown"
  },
  {
    quote: "Don't wait for the perfect moment. Take the moment and make it perfect.",
    author: "Zoey Sayward"
  },
  {
    quote: "You are never too old to set another goal or to dream a new dream.",
    author: "C.S. Lewis"
  },
  {
    quote: "Destiny is not a matter of chance, it is a matter of choice.",
    author: "William Jennings Bryan"
  },
  {
    quote: "In the middle of difficulty lies opportunity.",
    author: "Albert Einstein"
  },
  {
    quote: "Try to be a rainbow in someone's cloud.",
    author: "Maya Angelou"
  },
  {
    quote: "What we think, we become.",
    author: "Buddha"
  },
  {
    quote: "The only person you are destined to become is the person you decide to be.",
    author: "Ralph Waldo Emerson"
  }
];

export const PersonalizedGreeting: React.FC<PersonalizedGreetingProps> = ({
  userName,
  userRole,
  hideForSeniors = false,
}) => {
  // Get time of day greeting
  const timeOfDayGreeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Get daily quote (consistent for the day, changes daily)
  const dailyQuote = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    return INSPIRATIONAL_QUOTES[dayOfYear % INSPIRATIONAL_QUOTES.length];
  }, []);

  // Format user name for display
  const displayName = useMemo(() => {
    if (!userName) return 'there';

    // If email, extract name before @
    if (userName.includes('@')) {
      const namePart = userName.split('@')[0];
      // Capitalize first letter
      return namePart.charAt(0).toUpperCase() + namePart.slice(1);
    }

    return userName;
  }, [userName]);

  // Format role for display
  const displayRole = useMemo(() => {
    if (!userRole) return '';

    // Map role codes to display names with titles
    const roleMap: { [key: string]: string } = {
      'admin': 'Administrator',
      'doctor': 'Dr.',
      'nurse': 'Nurse',
      'nurse_practitioner': 'NP',
      'physician_assistant': 'PA',
      'volunteer': '',
      'staff': '',
    };

    return roleMap[userRole.toLowerCase()] || '';
  }, [userRole]);

  // Build full greeting
  const fullGreeting = useMemo(() => {
    let greeting = timeOfDayGreeting;

    if (displayRole && displayRole.length <= 3) {
      // Short titles like Dr., NP, PA go before name
      greeting += ` ${displayRole} ${displayName}`;
    } else if (displayRole) {
      // Longer titles like Administrator, Nurse go after
      greeting += ` ${displayName}`;
    } else {
      greeting += ` ${displayName}`;
    }

    return greeting;
  }, [timeOfDayGreeting, displayRole, displayName]);

  // Don't show for seniors (they have their own greeting)
  if (hideForSeniors) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-[#E0F7F6] via-[#F4FADC] to-[#E0F7F6] border-2 border-[#1BA39C] rounded-xl p-6 mb-6 shadow-xl">
      {/* Main Greeting */}
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-[#2D3339] mb-2">
          {fullGreeting}! 👋
        </h2>
        <p className="text-lg text-[#158A84] font-bold">
          Today's going to be an awesome day! ✨
        </p>
      </div>

      {/* Daily Inspirational Quote */}
      <div className="bg-white bg-opacity-90 rounded-lg p-4 border-l-4 border-[#C8E63D] shadow-md">
        <p className="text-[#2D3339] italic text-base leading-relaxed mb-2 font-medium">
          "{dailyQuote.quote}"
        </p>
        <p className="text-[#158A84] text-sm font-bold text-right">
          — {dailyQuote.author}
        </p>
      </div>
    </div>
  );
};

export default PersonalizedGreeting;
