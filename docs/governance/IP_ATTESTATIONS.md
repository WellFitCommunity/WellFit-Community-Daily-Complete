# ENVISION Atlus — IP Attestation Registry

This file contains cryptographic attestations for protected intellectual property.
Each entry proves a document existed at a specific time without revealing its contents.

**How to verify:** Hash the original document with SHA-256. If it matches the recorded hash,
the document is authentic and unmodified since attestation.

---

## Attested Documents

### EA-GOV-PP-001

| Field | Value |
|-------|-------|
| **Document ID** | EA-GOV-PP-001 |
| **Title** | Why AI-Built Software Fails in Regulated Environments — and Why Ours Didn't |
| **Classification** | Internal — Restricted |
| **Document Type** | Manufacturing & Governance Position Paper |
| **Attestation Date** | 2026-02-01 |
| **SHA-256 Hash** | `13b9e483b874d7a5fa38d3ecd4d83d0755d476ba9fa1de06dd54a35d5b405081` |
| **Status** | Ratified |

**Verification command:**
```bash
# Hash your copy of the document (before the hash was inserted)
cat EA-GOV-PP-001-unsigned.md | sha256sum
# Must equal: 13b9e483b874d7a5fa38d3ecd4d83d0755d476ba9fa1de06dd54a35d5b405081
```

---

## Attestation Policy

1. **Immutability**: Once a document is attested, its hash is permanent
2. **No Content Disclosure**: This registry contains hashes only, never document content
3. **Revision = New Hash**: Any document revision requires a new attestation entry
4. **Git History = Timestamp**: The git commit containing this attestation provides the timestamp

---

*This registry is maintained by ENVISION Atlus Executive & Governance Authority.*
