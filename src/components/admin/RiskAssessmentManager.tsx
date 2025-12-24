// Risk Assessment Manager Component
// Manages risk assessments for the admin dashboard

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useSupabaseClient, useUser } from '../../contexts/AuthContext';
import RiskAssessmentForm from './RiskAssessmentForm';
import { RiskAssessment, PatientProfile } from '../../types/riskAssessment';

// RiskAssessment and PatientProfile interfaces imported from shared types

const RiskAssessmentManager: React.FC = () => {
  const supabase = useSupabaseClient();
  const user = useUser();

  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [patients, setPatients] = useState<PatientProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  // Remove unused showForm state since form is now always accessible
  // const [showForm, setShowForm] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState<RiskAssessment | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Check if user has permission to manage assessments
  const canManageAssessments = user && ['admin', 'healthcare_provider', 'nurse'].includes(user.role || '');

  // Load assessments and patient data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Load all patients
      const { data: patientsData, error: patientsError } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, phone, email')
        .eq('role', 'senior');

      if (patientsError) throw patientsError;

      // Load recent assessments
      const { data: assessmentsData, error: assessmentsError } = await supabase
        .from('risk_assessments')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (assessmentsError) throw assessmentsError;

      // Enrich assessments with patient names
      const enrichedAssessments = assessmentsData?.map(assessment => {
        const patient = patientsData?.find(p => p.user_id === assessment.patient_id);
        const assessor = patientsData?.find(p => p.user_id === assessment.assessor_id);

        return {
          ...assessment,
          patient_name: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : 'Unknown Patient',
          assessor_name: assessor ? `${assessor.first_name || ''} ${assessor.last_name || ''}`.trim() : 'Unknown Assessor'
        };
      }) || [];

      setPatients(patientsData || []);
      setAssessments(enrichedAssessments);

    } catch (err) {

      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleNewAssessment = (patientId: string) => {
    setSelectedPatient(patientId);
    setEditingAssessment(null);
    setActiveTab('form');
  };

  const handleEditAssessment = (assessment: RiskAssessment) => {
    setSelectedPatient(assessment.patient_id);
    setEditingAssessment(assessment);
    setActiveTab('form');
  };

  const handleFormSubmit = (assessment: RiskAssessment) => {
    // Show success message with assessment details
    const patientName = patients.find(p => p.user_id === assessment.patient_id);
    const displayName = patientName
      ? `${patientName.first_name || ''} ${patientName.last_name || ''}`.trim()
      : 'patient';

    setSuccessMessage(`Risk assessment for ${displayName} saved successfully (Risk Level: ${assessment.risk_level || 'N/A'})`);

    // Clear success message after 5 seconds
    setTimeout(() => setSuccessMessage(null), 5000);

    loadData(); // Refresh data
    // Keep form open so user can create another assessment if needed
    // Just clear the current assessment
    setEditingAssessment(null);
  };

  const handleFormCancel = () => {
    setSelectedPatient(null);
    setEditingAssessment(null);
    setActiveTab('overview');
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'CRITICAL': return 'destructive';
      case 'HIGH': return 'destructive';
      case 'MODERATE': return 'secondary';
      case 'LOW': return 'default';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPatientRiskSummary = () => {
    const riskCounts = {
      CRITICAL: assessments.filter(a => a.risk_level === 'CRITICAL').length,
      HIGH: assessments.filter(a => a.risk_level === 'HIGH').length,
      MODERATE: assessments.filter(a => a.risk_level === 'MODERATE').length,
      LOW: assessments.filter(a => a.risk_level === 'LOW').length
    };

    const overdue = assessments.filter(a =>
      a.next_assessment_due && a.next_assessment_due.trim() !== '' && new Date(a.next_assessment_due) < new Date()
    ).length;

    return { riskCounts, overdue, total: assessments.length };
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div>Loading risk assessments...</div>
        </CardContent>
      </Card>
    );
  }

  const { riskCounts, overdue, total } = getPatientRiskSummary();
  const selectedPatientData = patients.find(p => p.user_id === selectedPatient);

  return (
    <div className="space-y-6">
      {/* Success message */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">{successMessage}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${canManageAssessments ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="assessments">All Assessments</TabsTrigger>
          {canManageAssessments && (
            <TabsTrigger value="form">
              Risk Assessment Form
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Risk Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-gray-900">{total}</div>
                <div className="text-sm text-gray-600">Total Assessments</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-600">{riskCounts.CRITICAL}</div>
                <div className="text-sm text-gray-600">Critical Risk</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-orange-600">{riskCounts.HIGH}</div>
                <div className="text-sm text-gray-600">High Risk</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-yellow-600">{riskCounts.MODERATE}</div>
                <div className="text-sm text-gray-600">Moderate Risk</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-red-500">{overdue}</div>
                <div className="text-sm text-gray-600">Overdue Reviews</div>
              </CardContent>
            </Card>
          </div>

          {/* Patients List */}
          <Card>
            <CardHeader>
              <CardTitle>Patient Risk Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {patients.map(patient => {
                  const latestAssessment = assessments
                    .filter(a => a.patient_id === patient.user_id)
                    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

                  const isOverdue = latestAssessment?.next_assessment_due &&
                    latestAssessment.next_assessment_due.trim() !== '' &&
                    new Date(latestAssessment.next_assessment_due) < new Date();

                  return (
                    <div key={patient.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div>
                          <div className="font-medium">
                            {patient.first_name} {patient.last_name}
                          </div>
                          <div className="text-sm text-gray-600">{patient.phone}</div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {latestAssessment ? (
                            <>
                              <Badge variant={getRiskLevelColor(latestAssessment.risk_level)}>
                                {latestAssessment.risk_level}
                              </Badge>
                              <span className={`px-2 py-1 text-xs rounded-sm ${getPriorityColor(latestAssessment.priority)}`}>
                                {latestAssessment.priority}
                              </span>
                              {isOverdue && (
                                <Badge variant="destructive">OVERDUE</Badge>
                              )}
                            </>
                          ) : (
                            <Badge variant="outline">No Assessment</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {latestAssessment && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditAssessment(latestAssessment)}
                          >
                            Edit
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleNewAssessment(patient.user_id)}
                        >
                          {latestAssessment ? 'New Assessment' : 'Assess'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assessments">
          <Card>
            <CardHeader>
              <CardTitle>All Risk Assessments</CardTitle>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-3">
                {assessments.map(assessment => (
                  <div key={assessment.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="font-medium">{assessment.patient_name}</div>
                        <Badge variant={getRiskLevelColor(assessment.risk_level)}>
                          {assessment.risk_level}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          Score: {assessment.overall_score}/10
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">
                          {assessment.created_at ? new Date(assessment.created_at).toLocaleDateString() : 'N/A'}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditAssessment(assessment)}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                    {assessment.assessment_notes && (
                      <div className="text-sm text-gray-600 mb-2">
                        {assessment.assessment_notes}
                      </div>
                    )}
                    {assessment.risk_factors && assessment.risk_factors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {assessment.risk_factors.map(factor => (
                          <span key={factor} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-sm">
                            {factor}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="form">
          <div className="space-y-6">
            {/* Patient Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Select Patient for Risk Assessment</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {patients.map(patient => (
                    <button
                      key={patient.user_id}
                      onClick={() => {
                        setSelectedPatient(patient.user_id);
                        setEditingAssessment(null);
                      }}
                      className={`p-4 border rounded-lg text-left hover:bg-gray-50 transition-colors ${
                        selectedPatient === patient.user_id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                      }`}
                    >
                      <div className="font-medium">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="text-sm text-gray-600">{patient.phone}</div>
                    </button>
                  ))}
                </div>
                {patients.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    No patients available for assessment
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Risk Assessment Form */}
            {selectedPatient && (
              <RiskAssessmentForm
                patientId={selectedPatient}
                patientName={selectedPatientData ?
                  `${selectedPatientData.first_name || ''} ${selectedPatientData.last_name || ''}`.trim() :
                  undefined
                }
                existingAssessment={editingAssessment}
                onSubmit={handleFormSubmit}
                onCancel={handleFormCancel}
              />
            )}

            {!selectedPatient && (
              <Card>
                <CardContent className="p-8 text-center text-gray-500">
                  <div className="text-lg font-medium mb-2">Ready to Create Risk Assessment</div>
                  <div>Please select a patient above to begin the assessment</div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RiskAssessmentManager;