"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const react_1 = __importDefault(require("react"));
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
    "The Lord is good… full of compassion. – Psalm 145:8"
];
const DailyScripture = () => {
    const today = new Date().getDate();
    return (<section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">Daily Scripture</h2>
      <p className="text-gray-800 italic">"{scriptures[today % scriptures.length]}"</p>
    </section>);
};
exports.default = DailyScripture;
