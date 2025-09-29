import React, { useState, useRef, useEffect } from 'react';
import './AudioRecorder.css';

const AudioRecorder = ({ onAudioRecorded, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const MAX_RECORDING_TIME = 120; // 2 minutes

  useEffect(() => {
    // Check for microphone permission
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));

    return () => {
      // Cleanup
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

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
      // Create a File object from the blob
      const audioFile = new File([audioBlob], `audio_${Date.now()}.webm`, {
        type: 'audio/webm'
      });
      
      onAudioRecorded(audioFile);
      
      // Cleanup
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setRecordingTime(0);
    }
  };

  const cancelRecording = () => {
    stopRecording();
    setAudioBlob(null);
    setAudioUrl(null);
    setRecordingTime(0);
    onCancel();
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (hasPermission === false) {
    return (
      <div className="audio-recorder-error">
        <p>🎤 Permissão de microfone necessária para gravar áudio</p>
        <button onClick={onCancel} className="cancel-btn">Cancelar</button>
      </div>
    );
  }

  if (audioBlob && audioUrl) {
    return (
      <div className="audio-recorder-preview">
        <div className="audio-preview">
          <audio controls src={audioUrl} />
          <div className="recording-info">
            <span>🎵 Áudio gravado ({formatTime(recordingTime)})</span>
          </div>
        </div>
        <div className="audio-actions">
          <button onClick={cancelRecording} className="cancel-btn">
            ❌ Cancelar
          </button>
          <button onClick={sendAudio} className="send-btn">
            📤 Enviar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="audio-recorder">
      <div className="recording-controls">
        {!isRecording ? (
          <button onClick={startRecording} className="start-recording-btn">
            🎤 Gravar Áudio
          </button>
        ) : (
          <div className="recording-active">
            <button onClick={stopRecording} className="stop-recording-btn">
              ⏹️ Parar
            </button>
            <div className="recording-timer">
              <div className="recording-indicator">
                <div className="pulse"></div>
                <span>Gravando... {formatTime(recordingTime)}</span>
              </div>
            </div>
          </div>
        )}
        <button onClick={onCancel} className="cancel-btn">
          ❌ Cancelar
        </button>
      </div>
    </div>
  );
};

export default AudioRecorder;