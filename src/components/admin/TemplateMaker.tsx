/**
 * Template Maker Component
 *
 * Allows admin, IT, and nurses to create and manage documentation templates.
 * Templates can be used for nursing notes, letters, forms, and structured documents.
 *
 * Accessible from: Admin Panel, IT Settings, Nurse Panel
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import { auditLogger } from '../../services/auditLogger';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Save,
  X,
  Eye,
  Copy,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { EACard, EACardHeader, EACardContent } from '../envision-atlus/EACard';
import { EAButton } from '../envision-atlus/EAButton';
import { EABadge } from '../envision-atlus/EABadge';

// Roles that can use templates
const TEMPLATE_ROLES = [
  { value: 'physician', label: 'Physician' },
  { value: 'nurse', label: 'Nurse' },
  { value: 'nurse_practitioner', label: 'Nurse Practitioner' },
  { value: 'physician_assistant', label: 'Physician Assistant' },
  { value: 'case_manager', label: 'Case Manager' },
  { value: 'social_worker', label: 'Social Worker' },
  { value: 'admin', label: 'Admin' },
];

// Task types by role
// Template categories
const TEMPLATE_CATEGORIES = [
  { value: 'clinical', label: 'Clinical Documentation' },
  { value: 'administrative', label: 'Administrative' },
  { value: 'communication', label: 'Communication' },
  { value: 'compliance', label: 'Compliance & Legal' },
  { value: 'education', label: 'Patient Education' },
  { value: 'general', label: 'General' },
];

// Template types
const TEMPLATE_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'form', label: 'Form' },
  { value: 'letter', label: 'Letter' },
  { value: 'note', label: 'Note' },
  { value: 'checklist', label: 'Checklist' },
];

const OUTPUT_FORMATS = [
  { value: 'narrative', label: 'Narrative', description: 'Free-form text document' },
  { value: 'form', label: 'Form', description: 'Structured form with fields' },
  { value: 'letter', label: 'Letter', description: 'Formal letter format' },
  { value: 'structured', label: 'Structured', description: 'Structured data output' },
];

// AI Models (for AI-assisted template generation)
const AI_MODELS = [
  { value: 'fast', label: 'Fast', description: 'Quick responses, cost-effective' },
  { value: 'balanced', label: 'Balanced', description: 'Good balance of speed & quality' },
  { value: 'accurate', label: 'Accurate', description: 'Highest quality output' },
];


interface TemplateField {
  name: string;
  type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean';
  label: string;
  placeholder?: string;
  options?: string[]; // For select type
  required?: boolean;
}

interface Template {
  id: string;
  role: string;
  category: string;
  template_name: string;
  description: string;
  template_type: string;
  content_template: string;
  required_fields: Record<string, string>;
  optional_fields: Record<string, string>;
  output_format: string;
  ai_model: string;
  ai_assisted: boolean;
  is_active: boolean;
  is_shared: boolean;
  version: number;
  created_by: string;
  tenant_id: string;
  created_at: string;
  updated_at: string;
}

interface TemplateMakerProps {
  /** Filter to specific role (optional) */
  roleFilter?: string;
  /** Compact mode for embedding in other panels */
  compact?: boolean;
  /** Callback when template is created/updated */
  onTemplateChange?: () => void;
}

export const TemplateMaker: React.FC<TemplateMakerProps> = ({
  roleFilter,
  compact = false,
  onTemplateChange,
}) => {
  const supabase = useSupabaseClient();
  const user = useUser();

  // State
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState(roleFilter || '');
  const [showActiveOnly, setShowActiveOnly] = useState(true);

  // Editor state
  const [isEditing, setIsEditing] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Partial<Template> | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Field builder state
  const [requiredFields, setRequiredFields] = useState<TemplateField[]>([]);
  const [optionalFields, setOptionalFields] = useState<TemplateField[]>([]);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('documentation_templates')
        .select('*')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (roleFilter) {
        query = query.eq('role', roleFilter);
      }

      if (showActiveOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTemplates(data || []);
    } catch (err: unknown) {
      auditLogger.error('TEMPLATE_LOAD_FAILED', err instanceof Error ? err : new Error('Unknown error'), {
        userId: user?.id,
      });
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [supabase, roleFilter, showActiveOnly, user?.id]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Filter templates
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch =
      !searchQuery ||
      template.template_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole = !selectedRole || template.role === selectedRole;

    return matchesSearch && matchesRole;
  });

  // Convert fields object to array for editor
  const fieldsToArray = (fields: Record<string, string>): TemplateField[] => {
    return Object.entries(fields).map(([name, type]) => ({
      name,
      type: type as TemplateField['type'],
      label: name.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    }));
  };

  // Convert fields array to object for saving
  const fieldsToObject = (fields: TemplateField[]): Record<string, string> => {
    return fields.reduce((acc, field) => {
      acc[field.name] = field.type;
      return acc;
    }, {} as Record<string, string>);
  };

  // Start creating new template
  const handleNewTemplate = () => {
    setEditingTemplate({
      role: roleFilter || 'nurse',
      category: 'general',
      template_type: 'document',
      template_name: '',
      description: '',
      content_template: '',
      output_format: 'narrative',
      ai_assisted: false,
      ai_model: 'balanced',
      is_active: true,
      is_shared: false,
    });
    setRequiredFields([]);
    setOptionalFields([]);
    setIsEditing(true);
  };

  // Start editing existing template
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setRequiredFields(fieldsToArray(template.required_fields || {}));
    setOptionalFields(fieldsToArray(template.optional_fields || {}));
    setIsEditing(true);
  };

  // Add a field
  const handleAddField = (isRequired: boolean) => {
    const newField: TemplateField = {
      name: '',
      type: 'text',
      label: '',
    };

    if (isRequired) {
      setRequiredFields([...requiredFields, newField]);
    } else {
      setOptionalFields([...optionalFields, newField]);
    }
  };

  // Update a field
  const handleUpdateField = (
    index: number,
    field: Partial<TemplateField>,
    isRequired: boolean
  ) => {
    if (isRequired) {
      const updated = [...requiredFields];
      updated[index] = { ...updated[index], ...field };
      // Auto-generate name from label
      if (field.label && !updated[index].name) {
        updated[index].name = field.label.toLowerCase().replace(/\s+/g, '_');
      }
      setRequiredFields(updated);
    } else {
      const updated = [...optionalFields];
      updated[index] = { ...updated[index], ...field };
      if (field.label && !updated[index].name) {
        updated[index].name = field.label.toLowerCase().replace(/\s+/g, '_');
      }
      setOptionalFields(updated);
    }
  };

  // Remove a field
  const handleRemoveField = (index: number, isRequired: boolean) => {
    if (isRequired) {
      setRequiredFields(requiredFields.filter((_, i) => i !== index));
    } else {
      setOptionalFields(optionalFields.filter((_, i) => i !== index));
    }
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    // Validation
    if (!editingTemplate.template_name?.trim()) {
      setError('Template name is required');
      return;
    }
    if (!editingTemplate.role) {
      setError('Role is required');
      return;
    }
    if (!editingTemplate.content_template?.trim()) {
      setError('Template content is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const templateData = {
        role: editingTemplate.role,
        category: editingTemplate.category || 'general',
        template_type: editingTemplate.template_type || 'document',
        template_name: editingTemplate.template_name.trim(),
        description: editingTemplate.description?.trim() || null,
        content_template: editingTemplate.content_template.trim(),
        required_fields: fieldsToObject(requiredFields),
        optional_fields: fieldsToObject(optionalFields),
        output_format: editingTemplate.output_format || 'narrative',
        ai_assisted: editingTemplate.ai_assisted ?? false,
        ai_model: editingTemplate.ai_model || 'balanced',
        is_active: editingTemplate.is_active ?? true,
        is_shared: editingTemplate.is_shared ?? false,
        created_by: user?.id,
      };

      if (editingTemplate.id) {
        // Update existing
        const { error: updateError } = await supabase
          .from('documentation_templates')
          .update({
            ...templateData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id);

        if (updateError) throw updateError;

        auditLogger.info('TEMPLATE_UPDATED', {
          userId: user?.id,
          templateId: editingTemplate.id,
          templateName: templateData.template_name,
        });

        setSuccess('Template updated successfully');
      } else {
        // Create new
        const { error: insertError } = await supabase
          .from('documentation_templates')
          .insert(templateData);

        if (insertError) throw insertError;

        auditLogger.info('TEMPLATE_CREATED', {
          userId: user?.id,
          templateName: templateData.template_name,
          role: templateData.role,
        });

        setSuccess('Template created successfully');
      }

      setIsEditing(false);
      setEditingTemplate(null);
      loadTemplates();
      onTemplateChange?.();
    } catch (err: unknown) {
      auditLogger.error('TEMPLATE_SAVE_FAILED', err instanceof Error ? err : new Error('Unknown error'), {
        userId: user?.id,
      });
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  // Delete template (soft delete)
  const handleDeleteTemplate = async (template: Template) => {
    if (!confirm(`Are you sure you want to delete "${template.template_name}"?`)) {
      return;
    }

    try {
      const { error: deleteError } = await supabase
        .from('documentation_templates')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', template.id);

      if (deleteError) throw deleteError;

      auditLogger.info('TEMPLATE_DELETED', {
        userId: user?.id,
        templateId: template.id,
        templateName: template.template_name,
      });

      setSuccess('Template deleted');
      loadTemplates();
      onTemplateChange?.();
    } catch (err: unknown) {
      auditLogger.error('TEMPLATE_DELETE_FAILED', err instanceof Error ? err : new Error('Unknown error'), {
        userId: user?.id,
      });
      setError('Failed to delete template');
    }
  };

  // Duplicate template
  const handleDuplicateTemplate = (template: Template) => {
    setEditingTemplate({
      ...template,
      id: undefined,
      template_name: `${template.template_name} (Copy)`,
    });
    setRequiredFields(fieldsToArray(template.required_fields || {}));
    setOptionalFields(fieldsToArray(template.optional_fields || {}));
    setIsEditing(true);
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingTemplate(null);
    setRequiredFields([]);
    setOptionalFields([]);
    setError(null);
  };

  // Clear messages
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Render field builder row
  const renderFieldRow = (field: TemplateField, index: number, isRequired: boolean) => (
    <div key={index} className="flex gap-2 items-start p-3 bg-slate-700/50 rounded-lg">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          type="text"
          placeholder="Field Label"
          value={field.label}
          onChange={(e) => handleUpdateField(index, { label: e.target.value }, isRequired)}
          className="px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 text-sm"
        />
        <input
          type="text"
          placeholder="field_name"
          value={field.name}
          onChange={(e) => handleUpdateField(index, { name: e.target.value }, isRequired)}
          className="px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white placeholder-slate-400 text-sm font-mono"
        />
        <select
          value={field.type}
          onChange={(e) =>
            handleUpdateField(index, { type: e.target.value as TemplateField['type'] }, isRequired)
          }
          className="px-3 py-2 bg-slate-600 border border-slate-500 rounded text-white text-sm"
        >
          <option value="text">Text</option>
          <option value="textarea">Text Area</option>
          <option value="number">Number</option>
          <option value="date">Date</option>
          <option value="select">Dropdown</option>
          <option value="boolean">Yes/No</option>
        </select>
      </div>
      <button
        onClick={() => handleRemoveField(index, isRequired)}
        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded"
        title="Remove field"
      >
        <X size={16} />
      </button>
    </div>
  );

  return (
    <div className={compact ? 'space-y-4' : 'space-y-6'}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <FileText className="text-[#00857a]" />
              Template Maker
            </h1>
            <p className="text-slate-400 mt-1">
              Create and manage documentation templates for your team
            </p>
          </div>
          <EAButton variant="primary" onClick={handleNewTemplate}>
            <Plus size={18} className="mr-2" />
            New Template
          </EAButton>
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg flex items-center gap-3">
          <AlertCircle className="text-red-400 flex-shrink-0" />
          <span className="text-red-200">{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-900/30 border border-green-500 rounded-lg flex items-center gap-3">
          <CheckCircle className="text-green-400 flex-shrink-0" />
          <span className="text-green-200">{success}</span>
        </div>
      )}

      {/* Editor Modal */}
      {isEditing && editingTemplate && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            {/* Editor Header */}
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-white">
                {editingTemplate.id ? 'Edit Template' : 'Create New Template'}
              </h2>
              <div className="flex items-center gap-2">
                <EAButton variant="ghost" onClick={() => setShowPreview(!showPreview)}>
                  <Eye size={18} className="mr-2" />
                  {showPreview ? 'Hide Preview' : 'Preview'}
                </EAButton>
                <EAButton variant="ghost" onClick={handleCancelEdit}>
                  <X size={18} />
                </EAButton>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Template Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingTemplate.template_name || ''}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, template_name: e.target.value })
                    }
                    placeholder="e.g., Nursing Handoff Note"
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Role <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={editingTemplate.role || ''}
                    onChange={(e) =>
                      setEditingTemplate({
                        ...editingTemplate,
                        role: e.target.value,
                      })
                    }
                    disabled={!!roleFilter}
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white disabled:opacity-50"
                  >
                    <option value="">Select Role...</option>
                    {TEMPLATE_ROLES.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Category
                  </label>
                  <select
                    value={editingTemplate.category || 'general'}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, category: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    {TEMPLATE_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Template Type
                  </label>
                  <select
                    value={editingTemplate.template_type || 'document'}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, template_type: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    {TEMPLATE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Output Format
                  </label>
                  <select
                    value={editingTemplate.output_format || 'narrative'}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, output_format: e.target.value })
                    }
                    className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    {OUTPUT_FORMATS.map((format) => (
                      <option key={format.value} value={format.value}>
                        {format.label} - {format.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editingTemplate.description || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, description: e.target.value })
                  }
                  placeholder="Brief description of what this template is for..."
                  rows={2}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                />
              </div>

              {/* Required Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-300">
                    Required Fields
                  </label>
                  <button
                    onClick={() => handleAddField(true)}
                    className="text-sm text-[#00857a] hover:text-[#00a99d] flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {requiredFields.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No required fields</p>
                  ) : (
                    requiredFields.map((field, index) => renderFieldRow(field, index, true))
                  )}
                </div>
              </div>

              {/* Optional Fields */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-300">
                    Optional Fields
                  </label>
                  <button
                    onClick={() => handleAddField(false)}
                    className="text-sm text-[#00857a] hover:text-[#00a99d] flex items-center gap-1"
                  >
                    <Plus size={14} /> Add Field
                  </button>
                </div>
                <div className="space-y-2">
                  {optionalFields.length === 0 ? (
                    <p className="text-slate-500 text-sm italic">No optional fields</p>
                  ) : (
                    optionalFields.map((field, index) => renderFieldRow(field, index, false))
                  )}
                </div>
              </div>

              {/* Template Content */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Template Content <span className="text-red-400">*</span>
                </label>
                <p className="text-xs text-slate-500 mb-2">
                  Use {'{field_name}'} placeholders for dynamic content. Example: {'{patient_name}'}, {'{diagnosis}'}
                </p>
                <textarea
                  value={editingTemplate.content_template || ''}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, content_template: e.target.value })
                  }
                  placeholder={`Enter template content with {placeholders} for dynamic fields...

Example:
Patient: {patient_name}
Date: {date}
Reason for visit: {reason}

Notes:
{notes}`}
                  rows={8}
                  className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 font-mono text-sm"
                />
              </div>

              {/* AI Assistance Settings */}
              <div className="p-4 bg-slate-700/50 rounded-lg border border-slate-600">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h4 className="font-medium text-white">AI Assistance</h4>
                    <p className="text-sm text-slate-400">
                      Enable AI to help fill in this template based on context
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingTemplate.ai_assisted ?? false}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, ai_assisted: e.target.checked })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#00857a] rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00857a]"></div>
                  </label>
                </div>

                {editingTemplate.ai_assisted && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-600">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        AI Quality Level
                      </label>
                      <select
                        value={editingTemplate.ai_model || 'balanced'}
                        onChange={(e) =>
                          setEditingTemplate({ ...editingTemplate, ai_model: e.target.value })
                        }
                        className="w-full px-4 py-2 bg-slate-600 border border-slate-500 rounded-lg text-white"
                      >
                        {AI_MODELS.map((model) => (
                          <option key={model.value} value={model.value}>
                            {model.label} - {model.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="text-sm text-slate-400 flex items-center">
                      <span className="bg-[#00857a]/20 text-[#00857a] px-3 py-2 rounded-lg">
                        AI will analyze context and suggest content for {'{placeholder}'} fields
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Template Settings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.is_active ?? true}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, is_active: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-slate-500 bg-slate-600 text-[#00857a]"
                  />
                  <span className="text-slate-300">Active</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.is_shared ?? false}
                    onChange={(e) =>
                      setEditingTemplate({ ...editingTemplate, is_shared: e.target.checked })
                    }
                    className="w-5 h-5 rounded border-slate-500 bg-slate-600 text-[#00857a]"
                  />
                  <span className="text-slate-300">Shared (visible to all users with this role)</span>
                </label>
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="p-4 bg-slate-900 rounded-lg border border-slate-600">
                  <h4 className="text-sm font-medium text-slate-300 mb-3">Preview</h4>
                  <div className="bg-white text-gray-800 p-4 rounded-lg text-sm whitespace-pre-wrap">
                    {editingTemplate.content_template || 'Enter template content to see preview...'}
                  </div>
                </div>
              )}
            </div>

            {/* Editor Footer */}
            <div className="sticky bottom-0 bg-slate-800 border-t border-slate-700 p-4 flex items-center justify-end gap-3">
              <EAButton variant="ghost" onClick={handleCancelEdit} disabled={saving}>
                Cancel
              </EAButton>
              <EAButton variant="primary" onClick={handleSaveTemplate} disabled={saving}>
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">...</span>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save size={18} className="mr-2" />
                    Save Template
                  </>
                )}
              </EAButton>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <EACard>
        <EACardContent className="py-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
              />
            </div>

            {/* Role Filter */}
            {!roleFilter && (
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
              >
                <option value="">All Roles</option>
                {TEMPLATE_ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            )}

            {/* Active Toggle */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-500 bg-slate-600 text-[#00857a]"
              />
              <span className="text-slate-300 text-sm">Active only</span>
            </label>

            {compact && (
              <EAButton variant="secondary" size="sm" onClick={handleNewTemplate}>
                <Plus size={16} className="mr-1" />
                New
              </EAButton>
            )}
          </div>
        </EACardContent>
      </EACard>

      {/* Templates List */}
      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-8 text-slate-400">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <EACard>
            <EACardContent className="py-8 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-500 mb-3" />
              <p className="text-slate-400">No templates found</p>
              <EAButton variant="primary" size="sm" onClick={handleNewTemplate} className="mt-4">
                <Plus size={16} className="mr-2" />
                Create Your First Template
              </EAButton>
            </EACardContent>
          </EACard>
        ) : (
          filteredTemplates.map((template) => (
            <EACard key={template.id} variant="default">
              <EACardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white">{template.template_name}</h3>
                      <EABadge variant={template.is_active ? 'normal' : 'neutral'} size="sm">
                        {template.is_active ? 'Active' : 'Inactive'}
                      </EABadge>
                      <EABadge variant="info" size="sm">
                        {template.output_format}
                      </EABadge>
                      {template.is_shared && (
                        <EABadge variant="elevated" size="sm">
                          Shared
                        </EABadge>
                      )}
                      {template.ai_assisted && (
                        <EABadge variant="normal" size="sm">
                          AI
                        </EABadge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-slate-400 mb-2">{template.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="bg-slate-700 px-2 py-1 rounded">
                        {TEMPLATE_ROLES.find((r) => r.value === template.role)?.label || template.role}
                      </span>
                      <span className="bg-slate-700 px-2 py-1 rounded">
                        {TEMPLATE_CATEGORIES.find((c) => c.value === template.category)?.label || template.category}
                      </span>
                      <span>
                        {Object.keys(template.required_fields || {}).length} required fields
                      </span>
                      <span>v{template.version}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDuplicateTemplate(template)}
                      className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </EACardContent>
            </EACard>
          ))
        )}
      </div>
    </div>
  );
};

export default TemplateMaker;
