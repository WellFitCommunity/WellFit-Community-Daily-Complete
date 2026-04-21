// Tests for MCP Patient Context Server — canonical cross-system patient data path
// Synthetic data only (Rule #15)

import {
  assertEquals,
  assertExists,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { TOOLS } from "../tools.ts";

Deno.test("MCP Patient Context Server - Tool Definitions", async (t) => {
  await t.step("exposes all 6 patient context tools plus ping", () => {
    const expectedTools = [
      "get_patient_context",
      "get_minimal_context",
      "get_patient_contacts",
      "get_patient_timeline",
      "get_patient_risk_summary",
      "patient_exists",
      "ping",
    ];
    for (const name of expectedTools) {
      assertExists((TOOLS as Record<string, unknown>)[name], `Tool ${name} should be defined`);
    }
    assertEquals(Object.keys(TOOLS).length, expectedTools.length);
  });

  await t.step("every tool has description and inputSchema", () => {
    for (const [name, tool] of Object.entries(TOOLS)) {
      const t = tool as { description?: string; inputSchema?: Record<string, unknown> };
      assertExists(t.description, `${name} missing description`);
      assertExists(t.inputSchema, `${name} missing inputSchema`);
      assert(t.description.length > 20, `${name} description should be substantive`);
    }
  });

  await t.step("all patient-data tools require patient_id as a required field", () => {
    const patientTools = [
      "get_patient_context",
      "get_minimal_context",
      "get_patient_contacts",
      "get_patient_timeline",
      "get_patient_risk_summary",
      "patient_exists",
    ];
    for (const name of patientTools) {
      const schema = (TOOLS as Record<string, { inputSchema: { required?: string[] } }>)[name]
        .inputSchema;
      assert(
        schema.required?.includes("patient_id"),
        `${name}.inputSchema.required should include 'patient_id'`
      );
    }
  });
});

Deno.test("MCP Patient Context Server - Tool Schemas", async (t) => {
  await t.step("get_patient_context accepts optional include flags and limits", () => {
    const schema = TOOLS.get_patient_context.inputSchema as {
      properties: Record<string, { type: string }>;
    };
    assertEquals(schema.properties.include_contacts.type, "boolean");
    assertEquals(schema.properties.include_timeline.type, "boolean");
    assertEquals(schema.properties.include_risk.type, "boolean");
    assertEquals(schema.properties.timeline_days.type, "number");
    assertEquals(schema.properties.max_timeline_events.type, "number");
  });

  await t.step("get_patient_timeline has days and max_events parameters", () => {
    const schema = TOOLS.get_patient_timeline.inputSchema as {
      properties: Record<string, unknown>;
    };
    assertExists(schema.properties.days);
    assertExists(schema.properties.max_events);
  });

  await t.step("patient_exists is the minimal-surface tool", () => {
    const schema = TOOLS.patient_exists.inputSchema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    // Should have ONLY patient_id — no other parameters
    assertEquals(Object.keys(schema.properties).length, 1);
    assertEquals(schema.required, ["patient_id"]);
  });
});

Deno.test("MCP Patient Context Server - ATLUS Accountability Contract", async (t) => {
  // context_meta must appear in every patient-data response per ATLUS
  // Accountability principle. These tests validate the *intent* at the
  // tool-definition level; the actual response shape is enforced by
  // toolHandlers.ts tests and the integration test suite.

  await t.step("get_patient_context description mentions context_meta", () => {
    const desc = TOOLS.get_patient_context.description;
    assert(
      desc.includes("context_meta"),
      "get_patient_context description must document context_meta as the audit trail"
    );
  });

  await t.step("description positions this as the canonical path", () => {
    const desc = TOOLS.get_patient_context.description;
    assert(
      desc.toLowerCase().includes("canonical") ||
        desc.toLowerCase().includes("authoritative") ||
        desc.toLowerCase().includes("instead of"),
      "Description should discourage ad-hoc queries against patient tables"
    );
  });
});
