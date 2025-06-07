import * as React from 'react';

const techTips: string[] = [
  // Part 1
  "🔒 Don’t share your password or PIN. Keep your secret numbers safe. Only you should know them.",
  "💸 Never send money to strangers on CashApp or Zelle. Call someone you trust if you’re unsure.",
  "🔁 Turn your phone off once a week. Wait 5 minutes, then turn it back on. It helps your phone run better.",
  "🚫 Don’t click links in strange texts or emails. If you didn’t ask for it, don’t tap it.",
  "📵 If it feels wrong, hang up. Real companies will not rush or scare you.",
  "🔋 Keep your phone charged above 20%. Low battery makes your phone act funny or shut off.",
  "👀 Use big text on your phone. It helps you see better and avoid mistakes.",
  "🛑 Don’t answer unknown calls. If it’s important, they’ll leave a message.",
  "📸 Don’t share pictures of your ID, checks, or cards. Keep your private info safe.",
  "📶 Move around if your phone is acting up. Go near a window for better signal.",

  // Part 2
  "🔄 Update your phone when it asks. Updates fix problems and add protection.",
  "🕵️‍♂️ If someone says they’re from Medicare or Social Security, hang up and call the real number.",
  "🔎 Ask someone you trust before downloading a new app.",
  "👂 Don’t say 'yes' to strange callers. Some scams record your voice.",
  "🔐 Use a passcode on your phone. It keeps your info safe if you lose it.",
  "🧹 Clear out old apps you don’t use. This makes your phone faster.",
  "🎤 Cover your camera or mic if you're not using it. It adds extra privacy.",
  "📴 Silence unknown numbers in your phone settings to avoid spam calls.",
  "📲 Always use Wi-Fi at home instead of phone data—it’s cheaper and faster.",
  "📥 Check app reviews before downloading. Look for 4 stars or more.",

  // Part 3
  "🌐 Don’t believe everything you see online. Some stories and pictures are fake.",
  "🔁 Restart apps that freeze or act funny. Close them and reopen.",
  "🔍 Use Google or YouTube to find how-to videos for common questions.",
  "📅 Set reminders on your phone for pills or appointments.",
  "🧑‍💻 Ask a grandchild or friend to help you with settings you don’t understand.",
  "📤 Back up your photos to the cloud or an email account.",
  "🚨 If your screen says it’s locked or hacked, don’t click anything. Turn it off and call for help.",
  "🖼️ Be careful when sharing photos. Some apps post to the public by default.",
  "👩‍⚕️ Don’t share health info with strangers online. Keep it private.",
  "🗂️ Save important phone numbers in your Contacts so you don’t forget."
];

const TechTip: React.FC = () => {
  const today = new Date().getDate();
  const tip = techTips[today % techTips.length];

  return (
    <section className="bg-white border-2 border-wellfit-green p-6 rounded-xl shadow-md">
      <h2 className="text-xl font-semibold text-wellfit-blue mb-2">
        Tech Tip of the Day
      </h2>
      <p className="text-gray-800">{tip}</p>
    </section>
  );
};

export default TechTip;
