import React, { useState, useRef } from 'react';
import { Camera, Upload, FileText, X, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';

interface UploadedForm {
  id: string;
  file: File;
  preview: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  extractedData?: any;
  error?: string;
}

/**
 * PaperFormUploader Component
 *
 * Allows staff to:
 * 1. Take photos of filled paper forms using device camera
 * 2. Upload scanned/photographed forms from device
 * 3. Process forms via Claude Vision API
 * 4. Review extracted data before enrollment
 *
 * Use cases:
 * - Rural hospitals with power/internet outages
 * - Emergency situations requiring paper backup
 * - Batch enrollment after system restoration
 */

const PaperFormUploader: React.FC = () => {
  const [uploadedForms, setUploadedForms] = useState<UploadedForm[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newForms: UploadedForm[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert(`${file.name} is not an image file. Please upload images only.`);
        continue;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name} is too large. Maximum file size is 10MB.`);
        continue;
      }

      // Create preview
      const preview = URL.createObjectURL(file);

      const formData: UploadedForm = {
        id: `form-${Date.now()}-${i}`,
        file,
        preview,
        status: 'uploading',
      };

      newForms.push(formData);
    }

    setUploadedForms((prev) => [...prev, ...newForms]);

    // Process each form
    for (const form of newForms) {
      await processForm(form);
    }
  };

  const processForm = async (form: UploadedForm) => {
    try {
      // Update status to processing
      updateFormStatus(form.id, 'processing');

      // Convert file to base64
      const base64 = await fileToBase64(form.file);

      // Call Edge Function to extract data via Claude Vision
      const { data, error } = await supabase.functions.invoke('extract-patient-form', {
        body: {
          image: base64,
          mimeType: form.file.type,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to process form');
      }

      if (!data || !data.success) {
        throw new Error(data?.error || 'Failed to extract data from form');
      }

      // Update with extracted data
      updateFormStatus(form.id, 'success', data.extractedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      updateFormStatus(form.id, 'error', undefined, errorMessage);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  };

  const updateFormStatus = (
    id: string,
    status: UploadedForm['status'],
    extractedData?: any,
    error?: string
  ) => {
    setUploadedForms((prev) =>
      prev.map((form) =>
        form.id === id
          ? { ...form, status, extractedData, error }
          : form
      )
    );
  };

  const removeForm = (id: string) => {
    setUploadedForms((prev) => {
      const form = prev.find((f) => f.id === id);
      if (form) {
        URL.revokeObjectURL(form.preview); // Clean up preview URL
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const getStatusIcon = (status: UploadedForm['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
    }
  };

  const getStatusText = (status: UploadedForm['status']) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing with AI...';
      case 'success':
        return 'Extracted successfully';
      case 'error':
        return 'Failed to extract';
    }
  };

  return (
    <div className="space-y-6">
      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <h4 className="font-semibold text-blue-900">Paper Form Scanner</h4>
            <p className="text-sm text-blue-800 mt-1">
              Upload photos or scans of completed patient enrollment forms. Our AI will automatically
              extract the information and prepare it for review and enrollment.
            </p>
            <ul className="list-disc ml-5 text-sm text-blue-800 mt-2">
              <li>Take clear, well-lit photos with all text visible</li>
              <li>Supported formats: JPG, PNG, HEIC, WebP</li>
              <li>Maximum file size: 10MB per image</li>
              <li>Cost: ~$0.005 per form processed</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Upload Area */}
      <div
        className={`border-4 border-dashed rounded-xl p-8 text-center transition-colors ${
          isDragging
            ? 'border-blue-600 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Camera className="w-8 h-8 text-blue-600" />
            </div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Upload className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Upload Patient Enrollment Forms
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop images here, or use the buttons below
            </p>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleCameraClick}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Camera className="w-5 h-5" />
              Take Photo
            </button>
            <button
              onClick={handleUploadClick}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Upload className="w-5 h-5" />
              Upload File
            </button>
          </div>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files)}
        />
      </div>

      {/* Uploaded Forms List */}
      {uploadedForms.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Uploaded Forms ({uploadedForms.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedForms.map((form) => (
              <div
                key={form.id}
                className="bg-white border-2 border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Preview Image */}
                <div className="relative h-48 bg-gray-100">
                  <img
                    src={form.preview}
                    alt={form.file.name}
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => removeForm(form.id)}
                    className="absolute top-2 right-2 p-1 bg-red-600 text-white rounded-full hover:bg-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Status */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getStatusIcon(form.status)}
                    <span className="text-sm font-medium">{getStatusText(form.status)}</span>
                  </div>

                  <p className="text-xs text-gray-600 truncate">{form.file.name}</p>

                  {form.error && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-sm text-xs text-red-800">
                      {form.error}
                    </div>
                  )}

                  {form.status === 'success' && form.extractedData && (
                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-sm text-xs">
                      <p className="font-semibold text-green-900">
                        {form.extractedData.firstName} {form.extractedData.lastName}
                      </p>
                      {form.extractedData.dob && (
                        <p className="text-green-800">DOB: {form.extractedData.dob}</p>
                      )}
                      {form.extractedData.mrn && (
                        <p className="text-green-800">MRN: {form.extractedData.mrn}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {uploadedForms.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">{uploadedForms.length}</div>
              <div className="text-sm text-gray-600">Total Forms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-blue-600">
                {uploadedForms.filter((f) => f.status === 'processing' || f.status === 'uploading').length}
              </div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {uploadedForms.filter((f) => f.status === 'success').length}
              </div>
              <div className="text-sm text-gray-600">Successful</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {uploadedForms.filter((f) => f.status === 'error').length}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaperFormUploader;
