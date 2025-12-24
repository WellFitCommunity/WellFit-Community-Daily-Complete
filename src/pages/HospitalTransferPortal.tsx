/**
 * Hospital-to-Hospital Transfer Portal
 *
 * Secure patient transfer between facilities with complete handoff documentation.
 * Supports both sending and receiving workflows.
 *
 * Copyright © 2025 Envision VirtualEdge Group LLC. All rights reserved.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Download,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  Building2,
  User,
  Pill,
  Activity,
  Phone,
  MapPin,
  Ambulance,
  RefreshCw,
  ChevronRight,
  Shield,
  ClipboardList,
} from 'lucide-react';

type TransferStatus = 'draft' | 'pending' | 'in_transit' | 'received' | 'completed';
type UrgencyLevel = 'routine' | 'urgent' | 'emergent' | 'stat';

interface TransferPacket {
  id: string;
  patientName: string;
  mrn: string;
  dob: string;
  sendingFacility: string;
  receivingFacility: string;
  transferReason: string;
  diagnosis: string;
  urgency: UrgencyLevel;
  status: TransferStatus;
  createdAt: string;
  eta?: string;
  transportMode: string;
  nurseContact: string;
  physicianContact: string;
  medications: number;
  allergies: number;
  labsAttached: number;
  imagingAttached: number;
}

interface TransferMetrics {
  pendingOutgoing: number;
  pendingIncoming: number;
  inTransit: number;
  completedToday: number;
  avgTransferTime: string;
  complianceRate: number;
}

const HospitalTransferPortal: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [metrics, setMetrics] = useState<TransferMetrics | null>(null);
  const [transfers, setTransfers] = useState<TransferPacket[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferPacket | null>(null);

  useEffect(() => {
    // Demo data for Methodist presentation
    const demoMetrics: TransferMetrics = {
      pendingOutgoing: 3,
      pendingIncoming: 2,
      inTransit: 4,
      completedToday: 12,
      avgTransferTime: '47 min',
      complianceRate: 98.5,
    };

    const demoTransfers: TransferPacket[] = [
    {
      id: '1',
      patientName: 'Robert Martinez',
      mrn: 'MHS-2024-445821',
      dob: '1952-03-15',
      sendingFacility: 'Methodist Hospital - Texas Medical Center',
      receivingFacility: 'Methodist Hospital - Sugar Land',
      transferReason: 'Step-down care - stable post cardiac catheterization',
      diagnosis: 'NSTEMI (I21.4), CAD (I25.10)',
      urgency: 'routine',
      status: 'in_transit',
      createdAt: '2024-12-04T09:30:00',
      eta: '11:15 AM',
      transportMode: 'BLS Ambulance',
      nurseContact: 'Sarah Johnson, RN (x4521)',
      physicianContact: 'Dr. Chen (x4100)',
      medications: 8,
      allergies: 2,
      labsAttached: 5,
      imagingAttached: 3,
    },
    {
      id: '2',
      patientName: 'Eleanor Washington',
      mrn: 'MHS-2024-447293',
      dob: '1945-08-22',
      sendingFacility: 'Methodist Hospital - Texas Medical Center',
      receivingFacility: 'Methodist Willowbrook Hospital',
      transferReason: 'SNF placement - rehab after hip replacement',
      diagnosis: 'S/P Right Total Hip Arthroplasty (Z96.641)',
      urgency: 'routine',
      status: 'pending',
      createdAt: '2024-12-04T10:15:00',
      transportMode: 'Wheelchair Van',
      nurseContact: 'Maria Garcia, RN (x4533)',
      physicianContact: 'Dr. Williams (x4200)',
      medications: 12,
      allergies: 1,
      labsAttached: 3,
      imagingAttached: 2,
    },
    {
      id: '3',
      patientName: 'James Thompson',
      mrn: 'MHS-2024-449102',
      dob: '1968-11-30',
      sendingFacility: 'Methodist Hospital Clear Lake',
      receivingFacility: 'Methodist Hospital - Texas Medical Center',
      transferReason: 'Higher level of care - STEMI requiring PCI',
      diagnosis: 'Acute STEMI anterior wall (I21.09)',
      urgency: 'stat',
      status: 'in_transit',
      createdAt: '2024-12-04T10:45:00',
      eta: '11:02 AM',
      transportMode: 'ALS Ambulance - Critical',
      nurseContact: 'Tom Bradley, RN (CL-2210)',
      physicianContact: 'Dr. Patel (CL-2100)',
      medications: 6,
      allergies: 0,
      labsAttached: 4,
      imagingAttached: 1,
    },
    {
      id: '4',
      patientName: 'Patricia Chen',
      mrn: 'MHS-2024-443567',
      dob: '1978-05-12',
      sendingFacility: 'Methodist Hospital - Texas Medical Center',
      receivingFacility: 'MD Anderson Cancer Center',
      transferReason: 'Oncology consultation - newly diagnosed pancreatic mass',
      diagnosis: 'Pancreatic mass (C25.9), obstructive jaundice (K83.1)',
      urgency: 'urgent',
      status: 'pending',
      createdAt: '2024-12-04T08:00:00',
      transportMode: 'BLS Ambulance',
      nurseContact: 'Lisa Wong, RN (x4545)',
      physicianContact: 'Dr. Rodriguez (x4300)',
      medications: 5,
      allergies: 3,
      labsAttached: 8,
      imagingAttached: 6,
    },
  ];

    const timer = setTimeout(() => {
      setMetrics(demoMetrics);
      setTransfers(demoTransfers);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getUrgencyColor = (urgency: UrgencyLevel) => {
    switch (urgency) {
      case 'stat': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'emergent': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      case 'urgent': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-green-500/20 text-green-400 border-green-500/50';
    }
  };

  const getStatusColor = (status: TransferStatus) => {
    switch (status) {
      case 'completed': return 'bg-green-500/20 text-green-400';
      case 'received': return 'bg-blue-500/20 text-blue-400';
      case 'in_transit': return 'bg-purple-500/20 text-purple-400';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400';
      default: return 'bg-slate-500/20 text-slate-400';
    }
  };

  const getStatusIcon = (status: TransferStatus) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'in_transit': return <Ambulance className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading Transfer Portal...</p>
        </div>
      </div>
    );
  }

  const outgoingTransfers = transfers.filter(t =>
    t.sendingFacility.includes('Texas Medical Center')
  );
  const incomingTransfers = transfers.filter(t =>
    t.receivingFacility.includes('Texas Medical Center')
  );

  const statTransfers = transfers.filter(t => t.urgency === 'stat' && t.status === 'in_transit');

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-linear-to-r from-blue-800 via-blue-700 to-indigo-800 text-white shadow-xl border-b border-blue-600">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-600 rounded-xl">
                <Building2 className="h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Hospital Transfer Portal</h1>
                <p className="text-blue-200 text-sm">Secure Inter-Facility Patient Transfers</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/transfer-logs')}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Transfer Logs
              </button>
              <button
                className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg transition-colors flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                New Transfer
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* STAT Alert Banner */}
      {statTransfers.length > 0 && (
        <div className="bg-linear-to-r from-red-600 to-red-700 text-white py-3 px-4 animate-pulse">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-bold">STAT TRANSFER IN PROGRESS:</span>
            <span>{statTransfers[0].patientName} - {statTransfers[0].diagnosis}</span>
            <span className="ml-auto font-semibold">ETA: {statTransfers[0].eta}</span>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-slate-800 rounded-xl border border-orange-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Send className="h-5 w-5 text-orange-400" />
              <span className="text-sm text-slate-400">Pending Out</span>
            </div>
            <div className="text-2xl font-bold text-orange-400">{metrics?.pendingOutgoing}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-blue-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Download className="h-5 w-5 text-blue-400" />
              <span className="text-sm text-slate-400">Pending In</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{metrics?.pendingIncoming}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-purple-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Ambulance className="h-5 w-5 text-purple-400" />
              <span className="text-sm text-slate-400">In Transit</span>
            </div>
            <div className="text-2xl font-bold text-purple-400">{metrics?.inTransit}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-green-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-5 w-5 text-green-400" />
              <span className="text-sm text-slate-400">Completed</span>
            </div>
            <div className="text-2xl font-bold text-green-400">{metrics?.completedToday}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-5 w-5 text-slate-400" />
              <span className="text-sm text-slate-400">Avg Time</span>
            </div>
            <div className="text-2xl font-bold text-white">{metrics?.avgTransferTime}</div>
          </div>

          <div className="bg-slate-800 rounded-xl border border-teal-500/30 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-5 w-5 text-teal-400" />
              <span className="text-sm text-slate-400">Compliance</span>
            </div>
            <div className="text-2xl font-bold text-teal-400">{metrics?.complianceRate}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-700">
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'outgoing'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Send className="h-4 w-4 inline mr-2" />
            Outgoing Transfers ({outgoingTransfers.length})
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-6 py-3 font-medium transition-colors ${
              activeTab === 'incoming'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Download className="h-4 w-4 inline mr-2" />
            Incoming Transfers ({incomingTransfers.length})
          </button>
        </div>

        {/* Transfer List */}
        <div className="space-y-4">
          {(activeTab === 'outgoing' ? outgoingTransfers : incomingTransfers).map((transfer) => (
            <div
              key={transfer.id}
              onClick={() => setSelectedTransfer(transfer)}
              className={`bg-slate-800 rounded-xl border cursor-pointer transition-all hover:border-blue-500/50 ${
                transfer.urgency === 'stat' ? 'border-red-500/50' : 'border-slate-700'
              } ${selectedTransfer?.id === transfer.id ? 'ring-2 ring-blue-500' : ''}`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-semibold text-white">{transfer.patientName}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(transfer.urgency)}`}>
                        {transfer.urgency.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(transfer.status)}`}>
                        {getStatusIcon(transfer.status)}
                        {transfer.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    <div className="text-sm text-slate-400 mb-2">
                      MRN: {transfer.mrn} | DOB: {transfer.dob}
                    </div>

                    <div className="text-sm text-white mb-3">
                      <strong>Diagnosis:</strong> {transfer.diagnosis}
                    </div>

                    <div className="flex items-center gap-6 text-sm">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Building2 className="h-4 w-4 text-blue-400" />
                        <span>{transfer.sendingFacility}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-500" />
                      <div className="flex items-center gap-2 text-slate-300">
                        <Building2 className="h-4 w-4 text-green-400" />
                        <span>{transfer.receivingFacility}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    {transfer.eta && (
                      <div className="text-lg font-bold text-purple-400 mb-1">
                        ETA: {transfer.eta}
                      </div>
                    )}
                    <div className="text-sm text-slate-400">
                      {transfer.transportMode}
                    </div>
                  </div>
                </div>

                {/* Packet Summary */}
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Pill className="h-4 w-4" />
                    <span>{transfer.medications} Medications</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{transfer.allergies} Allergies</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Activity className="h-4 w-4" />
                    <span>{transfer.labsAttached} Labs</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <FileText className="h-4 w-4" />
                    <span>{transfer.imagingAttached} Imaging</span>
                  </div>
                  <div className="ml-auto flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <Phone className="h-4 w-4" />
                      <span>{transfer.nurseContact}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Transfer Reason Section for Selected */}
        {selectedTransfer && (
          <div className="bg-slate-800 rounded-xl border border-blue-500/50 p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-blue-400" />
              Transfer Details: {selectedTransfer.patientName}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Transfer Reason</h4>
                <p className="text-white">{selectedTransfer.transferReason}</p>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Contact Information</h4>
                <p className="text-white">Nurse: {selectedTransfer.nurseContact}</p>
                <p className="text-white">Physician: {selectedTransfer.physicianContact}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors flex items-center gap-2">
                <FileText className="h-4 w-4" />
                View Full Packet
              </button>
              <button className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Acknowledge Receipt
              </button>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Call Sending Facility
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-slate-700 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Real-time updates every 30 seconds
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HIPAA Compliant</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">HL7 FHIR Ready</span>
              <span className="px-2 py-1 bg-slate-800 rounded-sm text-xs">Joint Commission</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HospitalTransferPortal;
