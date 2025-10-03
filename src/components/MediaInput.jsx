import React, { useState, useRef } from 'react';
import { useMessaging } from '../contexts/EnhancedMessagingContext';
import AudioRecorder from './AudioRecorder';
import './MediaInput.css';

const MediaInput = ({ onMediaSelect, disabled = false }) => {
  const { uploadingMedia, MESSAGE_TYPES } = useMessaging();
  const [showOptions, setShowOptions] = useState(false);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  const handleFileSelect = (type) => {
    return (event) => {
      const file = event.target.files[0];
      if (file) {
        // Validate file size (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
          alert('Arquivo muito grande. O tamanho máximo é 50MB.');
          return;
        }

        // Validate file type
        const validTypes = getValidFileTypes(type);
        if (!validTypes.includes(file.type)) {
          alert(`Tipo de arquivo não suportado para ${type}.`);
          return;
        }

        onMediaSelect(file, type);
        setShowOptions(false);
      }
      
      // Reset input
      event.target.value = '';
    };
  };

  const getValidFileTypes = (type) => {
    switch (type) {
      case MESSAGE_TYPES.IMAGE:
        return ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      case MESSAGE_TYPES.FILE:
        return [
          // Documents
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'text/plain',
          'text/csv',
          // Archives
          'application/zip',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          // Images (fallback)
          'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
          // Audio
          'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'
        ];
      default:
        return [];
    }
  };

  const handleAudioComplete = (audioBlob) => {
    const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
      type: 'audio/webm'
    });
    onMediaSelect(audioFile, MESSAGE_TYPES.AUDIO);
    setShowAudioRecorder(false);
  };

  const getFileAccept = (type) => {
    switch (type) {
      case MESSAGE_TYPES.IMAGE:
        return 'image/*';
      case MESSAGE_TYPES.FILE:
        return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.7z';
      default:
        return '*/*';
    }
  };

  return (
    <div className="media-input">
      {/* Media options button */}
      <button
        type="button"
        className="media-button"
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled || uploadingMedia}
        title="Anexar mídia"
      >
        {uploadingMedia ? (
          <div className="upload-spinner"></div>
        ) : (
          <i className="fas fa-paperclip"></i>
        )}
      </button>

      {/* Media options dropdown */}
      {showOptions && (
        <>
          <div className="media-options">
            <button
              type="button"
              className="media-option"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploadingMedia}
            >
              <i className="fas fa-image"></i>
              <span>Foto</span>
            </button>


            <button
              type="button"
              className="media-option"
              onClick={() => setShowAudioRecorder(true)}
              disabled={uploadingMedia}
            >
              <i className="fas fa-microphone"></i>
              <span>Áudio</span>
            </button>

            <button
              type="button"
              className="media-option"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingMedia}
            >
              <i className="fas fa-file"></i>
              <span>Arquivo</span>
            </button>
          </div>

          {/* Overlay to close options */}
          <div 
            className="media-options-overlay"
            onClick={() => setShowOptions(false)}
          />
        </>
      )}

      {/* Audio recorder modal */}
      {showAudioRecorder && (
        <AudioRecorder
          onComplete={handleAudioComplete}
          onCancel={() => setShowAudioRecorder(false)}
        />
      )}

      {/* Hidden file inputs */}
      <input
        ref={imageInputRef}
        type="file"
        accept={getFileAccept(MESSAGE_TYPES.IMAGE)}
        onChange={handleFileSelect(MESSAGE_TYPES.IMAGE)}
        style={{ display: 'none' }}
      />


      <input
        ref={fileInputRef}
        type="file"
        accept={getFileAccept(MESSAGE_TYPES.FILE)}
        onChange={handleFileSelect(MESSAGE_TYPES.FILE)}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default MediaInput;
