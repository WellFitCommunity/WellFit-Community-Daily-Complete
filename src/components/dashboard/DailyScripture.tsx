import * as React from 'react';

const scriptures = [
  "This is the day the Lord has made; let us rejoice and be glad in it. – Psalm 118:24",
  "The Lord is my shepherd; I shall not want. – Psalm 23:1",
  "I can do all things through Christ who strengthens me. – Philippians 4:13",
  "Trust in the Lord with all your heart. – Proverbs 3:5",
  "Be strong and courageous. Do not be afraid. – Joshua 1:9",
  "Cast all your anxiety on Him because He cares for you. – 1 Peter 5:7",
  "The joy of the Lord is your strength. – Nehemiah 8:10",
  "He will never leave you nor forsake you. – Hebrews 13:5",
  "Come to me all who are weary… and I will give you rest. – Matthew 11:28",
  "The Lord gives strength to his people. – Psalm 29:11",
  "Delight yourself in the Lord, and He will give you the desires of your heart. – Psalm 37:4",
  "He heals the brokenhearted and binds up their wounds. – Psalm 147:3",
  "Be still, and know that I am God. – Psalm 46:10",
  "Your word is a lamp to my feet… – Psalm 119:105",
  "God is our refuge and strength, an ever‑present help in trouble. – Psalm 46:1",
  "For I know the plans I have for you… plans to give you hope. – Jeremiah 29:11",
  "The Lord is close to the brokenhearted. – Psalm 34:18",
  "Fear not, for I am with you. – Isaiah 41:10",
  "Peace I leave with you; my peace I give you. – John 14:27",
  "He restores my soul. – Psalm 23:3",
  "Delight yourself also in the Lord… – Psalm 37:4",
  "The Lord will fight for you; you need only to be still. – Exodus 14:14",
  "A joyful heart is good medicine. – Proverbs 17:22",
  "Commit your way to the Lord; trust in Him. – Psalm 37:5",
  "He satisfies the longing soul. – Psalm 107:9",
  "Draw near to God and He will draw near to you. – James 4:8",
  "I have loved you with an everlasting love. – Jeremiah 31:3",
  "Rejoice in hope, be patient in tribulation. – Romans 12:12",
  "Let everything that has breath praise the Lord! – Psalm 150:6",
  "The Lord is good… full of compassion. – Psalm 145:8",
  
  // 40 Additional encouraging scriptures
  "But those who hope in the Lord will renew their strength. – Isaiah 40:31",
  "The steadfast love of the Lord never ceases. – Lamentations 3:22",
  "Nothing will be impossible with God. – Luke 1:37",
  "My grace is sufficient for you. – 2 Corinthians 12:9",
  "He gives power to the weak and strength to the powerless. – Isaiah 40:29",
  "The Lord your God is with you, the Mighty Warrior who saves. – Zephaniah 3:17",
  "In all things God works for the good of those who love Him. – Romans 8:28",
  "The Lord is my light and my salvation—whom shall I fear? – Psalm 27:1",
  "Weeping may stay for the night, but rejoicing comes in the morning. – Psalm 30:5",
  "He has made everything beautiful in its time. – Ecclesiastes 3:11",
  "The name of the Lord is a fortified tower. – Proverbs 18:10",
  "Great is His faithfulness; His mercies begin afresh each morning. – Lamentations 3:23",
  "Those who wait on the Lord shall renew their strength. – Isaiah 40:31",
  "His banner over me is love. – Song of Solomon 2:4",
  "The Lord delights in those who fear Him. – Psalm 147:11",
  "He tends His flock like a shepherd. – Isaiah 40:11",
  "Many are the plans in a person's heart, but it is the Lord's purpose that prevails. – Proverbs 19:21",
  "The Lord makes firm the steps of the one who delights in Him. – Psalm 37:23",
  "You are fearfully and wonderfully made. – Psalm 139:14",
  "The Lord will perfect that which concerns me. – Psalm 138:8",
  "His love endures forever. – Psalm 136:1",
  "The Lord watches over you—the Lord is your shade at your right hand. – Psalm 121:5",
  "He will call on me, and I will answer him. – Psalm 91:15",
  "The righteous person may have many troubles, but the Lord delivers him from them all. – Psalm 34:19",
  "The Lord upholds all who fall and lifts up all who are bowed down. – Psalm 145:14",
  "Because of the Lord's great love we are not consumed. – Lamentations 3:22",
  "He refreshes my soul and guides me along the right paths. – Psalm 23:3",
  "The Lord is good to those whose hope is in Him. – Lamentations 3:25",
  "Let us hold unswervingly to the hope we profess. – Hebrews 10:23",
  "The Lord will keep you from all harm—He will watch over your life. – Psalm 121:7",
  "God is able to bless you abundantly. – 2 Corinthians 9:8",
  "May the God of hope fill you with all joy and peace. – Romans 15:13",
  "The Lord is righteous in all His ways and faithful in all He does. – Psalm 145:17",
  "He will cover you with His feathers, and under His wings you will find refuge. – Psalm 91:4",
  "The Lord has done great things for us, and we are filled with joy. – Psalm 126:3",
  "Your faith has healed you. Go in peace. – Luke 8:48",
  "The Lord is my strength and my song. – Exodus 15:2",
  "He brought me out into a spacious place; He rescued me because He delighted in me. – Psalm 18:19",
  "The Lord will guide you always. – Isaiah 58:11",
  "He lifts the poor from the dust and the needy from the garbage dump. – Psalm 113:7",
  "The Lord is my helper; I will not be afraid. – Hebrews 13:6",
  "He has not despised or scorned the suffering of the afflicted one. – Psalm 22:24",
  "The Lord gives wisdom; from His mouth come knowledge and understanding. – Proverbs 2:6",
  "His compassions never fail. They are new every morning. – Lamentations 3:22-23",
  "The Lord is near to all who call on Him. – Psalm 145:18",
  "He will quiet you with His love, He will rejoice over you with singing. – Zephaniah 3:17",
  "The Lord blesses His people with peace. – Psalm 29:11",
  "He crowns you with love and compassion. – Psalm 103:4",
  "The Lord is my rock, my fortress and my deliverer. – Psalm 18:2",
  "He has made His wonderful works to be remembered. – Psalm 111:4"
];

const DailyScripture: React.FC = () => {
  const today = new Date().getDate();
  const currentScripture = scriptures[today % scriptures.length];
  
  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-semibold text-wellfit-blue">Daily Scripture</h2>
        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
          {today} of {scriptures.length}
        </span>
      </div>
      <blockquote className="text-gray-800 italic text-lg leading-relaxed">
        "{currentScripture}"
      </blockquote>
      <div className="mt-4 pt-3 border-t border-gray-200">
        <p className="text-sm text-gray-600 text-center">
          🙏 May this verse bring encouragement to your day
        </p>
      </div>
    </section>
  );
};

export default DailyScripture;