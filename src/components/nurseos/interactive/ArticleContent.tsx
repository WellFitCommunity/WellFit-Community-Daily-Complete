// Article Content Components — Static content for training modules

import React from 'react';

export const BoundariesArticleContent: React.FC = () => {
  return (
    <div className="space-y-4 text-gray-700">
      <h4 className="font-semibold text-lg">5 Scripts for Setting Boundaries</h4>

      <div className="space-y-3">
        <div>
          <p className="font-medium">1. When asked to take on extra patients:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200 italic">
            &quot;I appreciate you thinking of me, but I&apos;m at capacity right now. Taking on more would compromise the quality of care I can provide. Can we discuss redistributing the panel?&quot;
          </p>
        </div>

        <div>
          <p className="font-medium">2. When interrupted during documentation time:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200 italic">
            &quot;I need to finish this documentation to avoid errors. Can I connect with you in 15 minutes?&quot;
          </p>
        </div>

        <div>
          <p className="font-medium">3. When asked to work on your day off:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200 italic">
            &quot;I&apos;m unavailable that day. I need my scheduled time off to recharge and provide my best care. Let&apos;s look at other coverage options.&quot;
          </p>
        </div>
      </div>

      <p className="text-sm">
        <strong>Remember:</strong> Setting boundaries isn&apos;t selfish—it&apos;s essential for preventing burnout and maintaining quality patient care.
      </p>
    </div>
  );
};

export const CommunicationScriptsContent: React.FC = () => {
  return (
    <div className="space-y-4 text-gray-700">
      <h4 className="font-semibold text-lg">Difficult Conversation Templates</h4>

      <div className="space-y-3">
        <div>
          <p className="font-medium text-red-700">Reporting Unsafe Staffing:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200">
            &quot;I need to document a safety concern. Our current nurse-to-patient ratio is [X:Y], which exceeds safe limits. This creates risk for both patients and staff. What steps can we take to address this immediately?&quot;
          </p>
        </div>

        <div>
          <p className="font-medium text-orange-700">Addressing Lateral Violence:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200">
            &quot;When you [specific behavior], I felt [emotion]. I value our working relationship and would appreciate if we could [desired outcome]. Can we talk about this?&quot;
          </p>
        </div>

        <div>
          <p className="font-medium text-blue-700">Requesting Support:</p>
          <p className="text-sm bg-white p-3 rounded-sm border border-gray-200">
            &quot;I&apos;m managing a challenging patient situation and could use a second opinion. Do you have 5 minutes to help me think through this?&quot;
          </p>
        </div>
      </div>
    </div>
  );
};
