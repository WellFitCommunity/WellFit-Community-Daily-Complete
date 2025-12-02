-- ============================================================================
-- SET CREDENTIALS FOR METHODIST MEETING - RUN IN SQL EDITOR ONLY
-- DELETE THIS FILE IMMEDIATELY AFTER USE
-- ============================================================================

-- SET SUPABASE PASSWORDS (for /envision portal)
-- Maria LeBlanc
UPDATE auth.users
SET
  encrypted_password = crypt('WellFit2024!Methodist', gen_salt('bf')),
    updated_at = NOW()
    WHERE id = 'ba4f20ad-2707-467b-a87f-d46fe9255d2f';

    -- Akima Taylor
    UPDATE auth.users
    SET
      encrypted_password = crypt('WellFit2024!Methodist', gen_salt('bf')),
        updated_at = NOW()
        WHERE id = '06ce7189-1da3-4e22-a6b2-ede88aa1445a';

        -- SET ADMIN PANEL PINS (for /admin portal)
        -- Maria's PIN
        INSERT INTO staff_pins (user_id, role, pin_hash)
        VALUES (
          'ba4f20ad-2707-467b-a87f-d46fe9255d2f',
            'super_admin',
              crypt('2024', gen_salt('bf'))
              )
              ON CONFLICT (user_id, role) DO UPDATE SET
                pin_hash = crypt('2024', gen_salt('bf')),
                  updated_at = NOW();

                  -- Akima's PIN
                  INSERT INTO staff_pins (user_id, role, pin_hash)
                  VALUES (
                    '06ce7189-1da3-4e22-a6b2-ede88aa1445a',
                      'super_admin',
                        crypt('2024', gen_salt('bf'))
                        )
                        ON CONFLICT (user_id, role) DO UPDATE SET
                          pin_hash = crypt('2024', gen_salt('bf')),
                            updated_at = NOW();

                            -- VERIFY
                            SELECT 'Passwords and PINs set successfully!' AS status;

-- ============================================================================
-- CREDENTIALS SUMMARY:
-- ============================================================================
-- ENVISION PORTAL (/envision):
--   Email: Maria@thewellfitcommunity.org
--   Email: Akima@thewellfitcommunity.org
--   Password: WellFit2024!Methodist
--
-- ADMIN PANEL (/admin):
--   PIN: 2024
-- ============================================================================
-- DELETE THIS FILE AFTER RUNNING IN SUPABASE SQL EDITOR!
-- ============================================================================
