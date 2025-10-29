/**
 * Medication Photo Capture Component
 * Camera interface for medication reconciliation
 */

import React, { useState, useRef } from 'react';
import { chwService, MedicationPhoto } from '../../services/chwService';

interface MedicationPhotoCaptureProps {
  visitId: string;
  language: 'en' | 'es';
  onComplete: () => void;
  onBack: () => void;
}

export const MedicationPhotoCapture: React.FC<MedicationPhotoCaptureProps> = ({
  visitId,
  language,
  onComplete,
  onBack
}) => {
  const [photos, setPhotos] = useState<MedicationPhoto[]>([]);
  const [currentPhoto, setCurrentPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const translations = {
    en: {
      title: 'Medication Photos',
      instruction: 'Take a clear photo of each medication bottle',
      takePhoto: 'Take Photo',
      uploadPhoto: 'Upload Photo',
      retake: 'Retake',
      keep: 'Keep Photo',
      addAnother: 'Add Another',
      continue: 'Continue',
      back: 'Back',
      photoCount: 'Photos Taken',
      saving: 'Saving...',
      noPhotos: 'Please take at least one photo',
      cameraError: 'Camera not available. Please use upload instead.',
      adherenceQuestion: 'Are you taking all medications as prescribed?',
      yes: 'Yes',
      no: 'No',
      sometimes: 'Sometimes',
      notes: 'Notes (optional)',
      addNotes: 'Add notes about this medication...'
    },
    es: {
      title: 'Fotos de Medicamentos',
      instruction: 'Tome una foto clara de cada frasco de medicamento',
      takePhoto: 'Tomar Foto',
      uploadPhoto: 'Subir Foto',
      retake: 'Volver a tomar',
      keep: 'Guardar Foto',
      addAnother: 'Agregar Otra',
      continue: 'Continuar',
      back: 'Atrás',
      photoCount: 'Fotos Tomadas',
      saving: 'Guardando...',
      noPhotos: 'Por favor tome al menos una foto',
      cameraError: 'Cámara no disponible. Por favor use la carga en su lugar.',
      adherenceQuestion: '¿Está tomando todos los medicamentos según lo recetado?',
      yes: 'Sí',
      no: 'No',
      sometimes: 'A veces',
      notes: 'Notas (opcional)',
      addNotes: 'Agregar notas sobre este medicamento...'
    }
  };

  const t = translations[language];

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
        setError('');
      }
    } catch (err) {
      setError(t.cameraError);

    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get base64 image
    const photoData = canvas.toDataURL('image/jpeg', 0.8);
    setCurrentPhoto(photoData);
    stopCamera();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const photoData = e.target?.result as string;
      setCurrentPhoto(photoData);
    };
    reader.readAsDataURL(file);
  };

  const keepPhoto = () => {
    if (!currentPhoto) return;

    const newPhoto: MedicationPhoto = {
      id: 'med-photo-' + Date.now(),
      photo_data: currentPhoto,
      timestamp: new Date().toISOString()
    };

    setPhotos([...photos, newPhoto]);
    setCurrentPhoto(null);
  };

  const removePhoto = (id: string) => {
    setPhotos(photos.filter(p => p.id !== id));
  };

  const handleSave = async () => {
    if (photos.length === 0) {
      setError(t.noPhotos);
      return;
    }

    setLoading(true);
    setError('');

    try {
      await chwService.photoMedicationReconciliation(visitId, photos);
      onComplete();
    } catch (err) {
      setError('Failed to save photos. Data saved offline and will sync when connection is restored.');
      // Still proceed since we save offline
      setTimeout(() => onComplete(), 2000);
    } finally {
      setLoading(false);
    }
  };

  // Photo preview mode
  if (currentPhoto) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-12">
            <h2 className="text-4xl font-bold text-gray-800 mb-8 text-center">{t.title}</h2>

            <div className="mb-8">
              <img
                src={currentPhoto}
                alt="Medication"
                className="w-full rounded-2xl shadow-lg"
              />
            </div>

            <div className="flex gap-6">
              <button
                onClick={() => setCurrentPhoto(null)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {t.retake}
              </button>

              <button
                onClick={keepPhoto}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {t.keep}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Camera active mode
  if (cameraActive) {
    return (
      <div className="min-h-screen bg-black flex flex-col">
        <div className="flex-1 relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="bg-gray-900 p-8">
          <div className="flex gap-6 max-w-4xl mx-auto">
            <button
              onClick={stopCamera}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
            >
              {t.back}
            </button>

            <button
              onClick={capturePhoto}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
            >
              {t.takePhoto}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main photo list mode
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-12">
          <h2 className="text-5xl font-bold text-gray-800 mb-8 text-center">{t.title}</h2>

          <p className="text-2xl text-gray-600 mb-8 text-center">{t.instruction}</p>

          {/* Photo count */}
          <div className="bg-blue-100 border-4 border-blue-300 rounded-2xl p-6 mb-8 text-center">
            <p className="text-3xl font-bold text-blue-800">
              {t.photoCount}: {photos.length}
            </p>
          </div>

          {/* Photo grid */}
          {photos.length > 0 && (
            <div className="grid grid-cols-2 gap-6 mb-8">
              {photos.map((photo) => (
                <div key={photo.id} className="relative">
                  <img
                    src={photo.photo_data}
                    alt="Medication"
                    className="w-full h-48 object-cover rounded-xl shadow-lg"
                  />
                  <button
                    onClick={() => removePhoto(photo.id)}
                    className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white w-12 h-12 rounded-full text-2xl font-bold shadow-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-yellow-100 border-4 border-yellow-400 text-yellow-800 px-6 py-4 rounded-xl text-xl mb-8">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-6">
            <button
              onClick={startCamera}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
            >
              {t.takePhoto}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
            >
              {t.uploadPhoto}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex gap-6 pt-4">
              <button
                onClick={onBack}
                disabled={loading}
                className="flex-1 bg-gray-300 hover:bg-gray-400 disabled:bg-gray-200 text-gray-800 text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {t.back}
              </button>

              <button
                onClick={handleSave}
                disabled={loading || photos.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-3xl font-bold py-8 px-8 rounded-2xl transition-all"
              >
                {loading ? t.saving : t.continue}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
