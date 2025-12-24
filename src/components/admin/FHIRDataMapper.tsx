import React, { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { ErrorBoundary } from '../ErrorBoundary';
import { MappingTableSkeleton, StatsSkeleton, CodePreviewSkeleton } from '../ui/skeleton';
import { useFHIRMapping } from '../../hooks/useFHIRMapping';
import { wellFitCodeGenerator } from '../../services/fhirCodeGeneration';

interface FormData {
  sourceType: 'HL7v2' | 'CSV' | 'JSON' | 'XML' | 'Custom';
  sourceData: string;
}

const FHIRDataMapper: React.FC = () => {
  const [state, actions] = useFHIRMapping();
  const [viewMode, setViewMode] = React.useState<'rules' | 'preview' | 'code'>('rules');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors: formErrors } } = useForm<FormData>({
    defaultValues: {
      sourceType: 'JSON',
      sourceData: ''
    }
  });

  const watchedSourceType = watch('sourceType');
  const watchedSourceData = watch('sourceData');

  // Sample data templates
  const sampleData: Record<string, string> = {
    HL7v2: `MSH|^~\\&|EPIC|EPICADT|SMS|SMSADT|199912271408|CHARRIS|ADT^A04|1817457|D|2.5
PID|0001||PATID1234^5^M11^ADT1^MR^UNIVERSITY HOSPITAL~123456789^^^USSSA^SS||EVERYMAN^ADAM^A^III||19610615|M||C|1200 N ELM STREET^^GREENSBORO^NC^27401-1020|GL|(919)379-1212|(919)271-3434~(919)277-3114||S||PATID12345001^2^M10^ADT1^AN^A|123456789|9-87654^NC`,
    
    CSV: `patient_id,first_name,last_name,dob,gender,phone,address,city,state,zip,mrn
12345,John,Smith,1985-03-15,M,555-0123,123 Main St,Anytown,TX,12345,MRN001
67890,Jane,Doe,1990-07-22,F,555-0456,456 Oak Ave,Somewhere,CA,67890,MRN002`,

    JSON: `{
  "patients": [
    {
      "id": "12345",
      "demographics": {
        "firstName": "John",
        "lastName": "Smith",
        "dateOfBirth": "1985-03-15",
        "gender": "M",
        "phone": "555-0123",
        "address": {
          "street": "123 Main St",
          "city": "Anytown", 
          "state": "TX",
          "zip": "12345"
        }
      },
      "identifiers": {
        "mrn": "MRN001",
        "ssn": "123-45-6789"
      },
      "vitals": [
        {
          "date": "2024-01-15",
          "bloodPressure": "120/80",
          "heartRate": 72,
          "temperature": 98.6
        }
      ]
    }
  ]
}`,

    XML: `<?xml version="1.0" encoding="UTF-8"?>
<patients>
  <patient id="12345">
    <demographics>
      <firstName>John</firstName>
      <lastName>Smith</lastName>
      <dateOfBirth>1985-03-15</dateOfBirth>
      <gender>M</gender>
    </demographics>
    <contact>
      <phone>555-0123</phone>
      <address>
        <street>123 Main St</street>
        <city>Anytown</city>
        <state>TX</state>
        <zip>12345</zip>
      </address>
    </contact>
  </patient>
</patients>`
  };

  const onSubmit = async (data: FormData) => {
    actions.setSourceData(data.sourceData);
    actions.setSourceType(data.sourceType);
    await actions.generateMapping();
  };

  const loadSampleData = (type: string) => {
    const data = sampleData[type];
    setValue('sourceData', data);
    setValue('sourceType', type as any);
    actions.setSourceData(data);
    actions.setSourceType(type as any);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await actions.loadFromFile(file);
      setValue('sourceData', state.sourceData);
      setValue('sourceType', state.sourceType);
    } catch (error) {

    }
  };


  const generateTransformCode = () => {
    if (!state.generatedMapping) return '';
    return wellFitCodeGenerator.generateFullCode(state.generatedMapping);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-50';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>🔄 Intelligent FHIR Data Mapping Agent</CardTitle>
          <p className="text-gray-600">
            Upload or paste legacy healthcare data to automatically generate FHIR R4 mapping rules for WellFit integration
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Data Input Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="font-medium">Source Data Type:</label>
                  <select
                    {...register('sourceType', { required: 'Source type is required' })}
                    className="p-2 border border-gray-300 rounded-sm"
                  >
                    <option value="JSON">JSON</option>
                    <option value="CSV">CSV</option>
                    <option value="HL7v2">HL7 v2</option>
                    <option value="XML">XML</option>
                    <option value="Custom">Custom Format</option>
                  </select>
                  {formErrors.sourceType && (
                    <span className="text-red-500 text-sm">{formErrors.sourceType.message}</span>
                  )}
                </div>

              <div className="mb-3">
                <div className="flex gap-2 mb-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📁 Upload File
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => loadSampleData(watchedSourceType)}
                  >
                    📝 Load Sample
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".csv,.json,.xml,.hl7,.txt"
                  className="hidden"
                />
              </div>

                <textarea
                  {...register('sourceData', {
                    required: 'Source data is required',
                    minLength: { value: 10, message: 'Source data must be at least 10 characters' }
                  })}
                  placeholder={`Paste your ${watchedSourceType} data here...`}
                  className="w-full h-64 p-3 border border-gray-300 rounded-lg font-mono text-sm resize-none"
                />
                {formErrors.sourceData && (
                  <span className="text-red-500 text-sm">{formErrors.sourceData.message}</span>
                )}
            </div>

            <div>
              <h3 className="font-medium mb-3">Sample Data Formats:</h3>
              <div className="space-y-2">
                {Object.entries(sampleData).map(([type, data]) => (
                  <button
                    key={type}
                    onClick={() => loadSampleData(type)}
                    className="w-full text-left p-3 border border-gray-200 rounded-sm hover:bg-gray-50"
                  >
                    <div className="font-medium">{type}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {data.substring(0, 80)}...
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-4 bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-2">🎯 WellFit Integration</h4>
                <p className="text-sm text-blue-700">
                  Generated mappings will include transformation code specifically for your 
                  WellFit database schema (profiles, check_ins, self_reports tables).
                </p>
              </div>
            </div>
          </div>

            <div className="flex gap-3">
              <Button
                type="submit"
                disabled={state.isAnalyzing || !watchedSourceData.trim()}
              >
                {state.isAnalyzing ? '🔄 Analyzing...' : '🚀 Generate FHIR Mapping'}
              </Button>

              {state.generatedMapping && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={actions.downloadMapping}
                >
                  📥 Download Mapping
                </Button>
              )}
            </div>
          </form>

          {/* Error Display */}
          {state.errors.length > 0 && (
            <Alert variant="destructive">
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {state.errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={actions.clearErrors}
                >
                  Clear Errors
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Warning Display */}
          {state.warnings.length > 0 && (
            <Alert>
              <AlertDescription>
                <ul className="list-disc list-inside">
                  {state.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  onClick={actions.clearWarnings}
                >
                  Clear Warnings
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

        {/* Generated Mapping Display */}
        {state.isAnalyzing ? (
          <Card>
            <CardHeader>
              <CardTitle>🔄 Analyzing Data...</CardTitle>
            </CardHeader>
            <CardContent>
              <StatsSkeleton />
              <div className="mt-6">
                <MappingTableSkeleton />
              </div>
            </CardContent>
          </Card>
        ) : state.generatedMapping && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Generated FHIR Mapping</CardTitle>
                <p className="text-gray-600">{state.generatedMapping?.sourceName ?? ''}</p>
              </div>
              
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('rules')}
                  className={`px-3 py-1 text-sm ${viewMode === 'rules' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
                >
                  📋 Mapping Rules
                </button>
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-3 py-1 text-sm border-l border-gray-300 ${viewMode === 'preview' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
                >
                  👁️ FHIR Preview
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-3 py-1 text-sm border-l border-gray-300 ${viewMode === 'code' ? 'bg-blue-100 text-blue-700' : 'bg-white'}`}
                >
                  💻 WellFit Integration Code
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Validation Results Summary */}
            {state.generatedMapping?.validationResults && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {state.generatedMapping.validationResults.totalFields}
                  </div>
                  <div className="text-sm text-blue-800">Total Fields</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {state.generatedMapping.validationResults.mappedFields}
                  </div>
                  <div className="text-sm text-green-800">Mapped Fields</div>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {state.generatedMapping.validationResults.unmappedFields.length}
                  </div>
                  <div className="text-sm text-yellow-800">Unmapped Fields</div>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {state.generatedMapping.validationResults.confidence}%
                  </div>
                  <div className="text-sm text-purple-800">Confidence</div>
                </div>
              </div>
            )}

            {viewMode === 'rules' && (
              <div className="space-y-4">
                <h3 className="font-medium">Mapping Rules ({state.generatedMapping?.mappingRules?.length ?? 0})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="border border-gray-300 px-4 py-2 text-left">Source Field</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">FHIR Resource</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">FHIR Path</th>
                        <th className="border border-gray-300 px-4 py-2 text-left">Transformation</th>
                        <th className="border border-gray-300 px-4 py-2 text-center">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(state.generatedMapping?.mappingRules ?? []).map((rule, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                            {rule.sourceField}
                            <div className="text-xs text-gray-500">{rule.sourceType}</div>
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-sm text-xs">
                              {rule.fhirResource}
                            </span>
                          </td>
                          <td className="border border-gray-300 px-4 py-2 font-mono text-sm">
                            {rule.fhirPath}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-sm">
                            {rule.transformation || 'Direct mapping'}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 text-center">
                            <span className={`px-2 py-1 rounded-sm text-xs ${getConfidenceColor(rule.confidence)}`}>
                              {rule.confidence}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {state.generatedMapping?.validationResults?.unmappedFields &&
                state.generatedMapping.validationResults.unmappedFields.length > 0 && (
                  <Alert>
                    <AlertDescription>
                      <strong>Unmapped Fields:</strong> {state.generatedMapping.validationResults.unmappedFields.join(', ')}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {viewMode === 'preview' && (
              <div className="space-y-4">
                <h3 className="font-medium">FHIR Resources Preview</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {['Patient', 'Observation', 'Encounter'].map(resourceType => {
                    const rules = (state.generatedMapping?.mappingRules ?? []).filter(r => r.fhirResource === resourceType);
                    if (rules.length === 0) return null;
                    
                    return (
                      <div key={resourceType} className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">{resourceType}</h4>
                        <div className="space-y-2">
                          {rules.slice(0, 5).map((rule, index) => (
                            <div key={index} className="text-sm">
                              <div className="font-mono text-blue-600">{rule.fhirPath}</div>
                              <div className="text-gray-500">← {rule.sourceField}</div>
                            </div>
                          ))}
                          {rules.length > 5 && (
                            <div className="text-xs text-gray-500">
                              +{rules.length - 5} more fields
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {viewMode === 'code' && (
              state.isAnalyzing ? (
                <CodePreviewSkeleton />
              ) : (
                <div className="space-y-4">
                  <h3 className="font-medium">Generated WellFit Integration Code</h3>
                  <div className="bg-gray-100 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">TypeScript for WellFit Integration</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(generateTransformCode())}
                      >
                        📋 Copy Code
                      </Button>
                    </div>
                    <pre className="text-xs overflow-auto max-h-96 bg-white p-3 rounded-sm border">
                      {generateTransformCode()}
                    </pre>
                  </div>
                
                <Alert>
                  <AlertDescription>
                    <strong>Ready for Integration:</strong> This code is specifically designed for your WellFit 
                    database schema and includes methods to sync FHIR data to your existing Supabase tables.
                  </AlertDescription>
                  </Alert>
                </div>
              )
            )}
          </CardContent>
        </Card>
      )}

        {/* Integration Options */}
        {state.generatedMapping && (
        <Card>
          <CardHeader>
            <CardTitle>🔗 Deploy to WellFit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">🔄 Real-time Sync</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Set up automatic transformation as EHR data arrives
                </p>
                <Button size="sm" className="w-full">
                  Configure Pipeline
                </Button>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">📦 Batch Import</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Import historical data using this mapping
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Start Import
                </Button>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">🎯 Custom Pipeline</h3>
                <p className="text-sm text-gray-600 mb-3">
                  Build custom transformation workflows
                </p>
                <Button size="sm" variant="outline" className="w-full">
                  Build Pipeline
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      </div>
    </ErrorBoundary>
  );
};

export default FHIRDataMapper;