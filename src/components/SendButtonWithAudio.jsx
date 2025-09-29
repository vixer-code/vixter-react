import React, { useState, useRef, useEffect } from 'react';
import './SendButtonWithAudio.css';

const SendButtonWithAudio = ({ 
  onSendMessage, 
  onSendAudio, 
  messageText, 
  sending, 
  disabled,
  isServiceCompleted 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const MAX_RECORDING_TIME = 120; // 2 minutes

  useEffect(() => {
    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        setShowPreview(true);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return MAX_RECORDING_TIME;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  };

  const sendAudio = () => {
    if (audioBlob) {
      const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      onSendAudio(audioFile);
      
      // Cleanup
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setShowPreview(false);
      setRecordingTime(0);
    }
  };

  const cancelAudio = () => {
    stopRecording();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setShowPreview(false);
    setRecordingTime(0);
  };

  const handleClick = () => {
    if (isServiceCompleted) return;
    
    if (messageText.trim()) {
      // Send text message
      onSendMessage();
    } else if (isRecording) {
      // Stop recording
      stopRecording();
    } else if (showPreview) {
      // Send audio
      sendAudio();
    } else {
      // Start recording
      startRecording();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getButtonContent = () => {
    if (sending) return '⏳';
    if (showPreview) return '📤';
    if (isRecording) return '⏹️';
    if (messageText.trim()) return '➤';
    return <img src="/images/mic.png" alt="Gravar áudio" style={{ width: '20px', height: '20px' }} />;
  };

  const getButtonTitle = () => {
    if (isServiceCompleted) return 'Serviço finalizado';
    if (sending) return 'Enviando...';
    if (showPreview) return 'Enviar áudio';
    if (isRecording) return `Parar gravação (${formatTime(recordingTime)})`;
    if (messageText.trim()) return 'Enviar mensagem';
    return 'Gravar áudio';
  };

  return (
    <div className="send-button-container">
      <button
        onClick={handleClick}
        className={`send-button ${isRecording ? 'recording' : ''} ${showPreview ? 'preview' : ''}`}
        disabled={disabled || isServiceCompleted}
        title={getButtonTitle()}
      >
        {getButtonContent()}
      </button>
      
      {showPreview && (
        <div className="audio-preview-overlay">
          <div className="audio-preview-content">
            <audio controls src={audioUrl} />
            <div className="audio-actions">
              <button onClick={cancelAudio} className="cancel-audio-btn">
                ❌
              </button>
              <button onClick={sendAudio} className="send-audio-btn">
                📤 Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SendButtonWithAudio;
