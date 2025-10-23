/**
 * Custom ESLint Plugin for HIPAA Compliance
 * Prevents PHI from being logged to console
 */

module.exports = {
  rules: {
    'no-phi-in-console': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent PHI (Protected Health Information) from being logged to console',
          category: 'Security',
          recommended: true,
        },
        messages: {
          phiInConsole: 'Potential PHI "{{identifier}}" found in console.{{method}}(). ' +
            'PHI must not be logged to console per HIPAA §164.312(a)(1). ' +
            'Use sanitized values or remove entirely.',
        },
        schema: [],
      },
      create(context) {
        // PHI-related identifiers that should never be in console logs
        const phiIdentifiers = [
          'phone',
          'email',
          'address',
          'mrn',
          'ssn',
          'dob',
          'patient',
          'patientId',
          'patient_id',
          'userId',
          'user_id',
          'diagnosis',
          'medication',
          'lab',
          'vital',
          'encounter',
          'insurance',
          'subscriber',
          'guardian',
          'emergency_contact',
        ];

        function checkForPHI(node) {
          const sourceCode = context.getSourceCode();
          const text = sourceCode.getText(node);

          // Check if any PHI identifier is present in the console statement
          for (const phi of phiIdentifiers) {
            const regex = new RegExp(`\\b${phi}\\b`, 'i');
            if (regex.test(text)) {
              return phi;
            }
          }
          return null;
        }

        return {
          CallExpression(node) {
            // Check for console.log, console.error, console.warn, console.info
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.object.name === 'console' &&
              ['log', 'error', 'warn', 'info'].includes(node.callee.property.name)
            ) {
              // Check all arguments for PHI
              for (const arg of node.arguments) {
                const phiFound = checkForPHI(arg);
                if (phiFound) {
                  context.report({
                    node,
                    messageId: 'phiInConsole',
                    data: {
                      identifier: phiFound,
                      method: node.callee.property.name,
                    },
                  });
                  break; // Report once per console statement
                }
              }
            }
          },
        };
      },
    },
  },
};
