import React, { useState, useRef, useEffect, useCallback } from 'react';
import './AudioRecorder.css';

const AudioRecorder = ({ onComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);

  const MAX_RECORDING_TIME = 300; // 5 minutes in seconds

  // Initialize audio recording
  const initializeRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
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
        
        // Stop all tracks to release microphone
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) {
      await initializeRecording();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'inactive') {
      setIsRecording(true);
      setRecordingTime(0);
      setError(null);
      
      mediaRecorderRef.current.start();
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_RECORDING_TIME) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    }
  }, [initializeRecording]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  // Toggle playback
  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioBlob) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      const audioUrl = URL.createObjectURL(audioBlob);
      audioRef.current.src = audioUrl;
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioBlob]);

  // Delete recording and restart
  const deleteRecording = useCallback(() => {
    setAudioBlob(null);
    setRecordingTime(0);
    setPlaybackTime(0);
    setIsPlaying(false);
    
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  // Send recording
  const sendRecording = useCallback(() => {
    if (audioBlob) {
      onComplete(audioBlob);
    }
  }, [audioBlob, onComplete]);

  // Format time for display
  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Handle audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updatePlaybackTime = () => {
      setPlaybackTime(Math.floor(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackTime(0);
    };

    audio.addEventListener('timeupdate', updatePlaybackTime);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updatePlaybackTime);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioBlob]);

  // Initialize on mount
  useEffect(() => {
    initializeRecording();
    
    return () => {
      // Cleanup
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [initializeRecording]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onCancel]);

  return (
    <div className="audio-recorder-overlay">
      <div className="audio-recorder-modal">
        <div className="audio-recorder-header">
          <h3>Gravar Mensagem de Voz</h3>
          <button 
            onClick={onCancel}
            className="close-button"
            title="Fechar"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="audio-recorder-body">
          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-triangle"></i>
              <span>{error}</span>
            </div>
          )}

          {!error && (
            <>
              {/* Recording visualizer */}
              <div className="recording-visualizer">
                <div className={`microphone-icon ${isRecording ? 'recording' : ''}`}>
                  <i className="fas fa-microphone"></i>
                </div>
                
                {isRecording && (
                  <div className="sound-waves">
                    <div className="wave"></div>
                    <div className="wave"></div>
                    <div className="wave"></div>
                  </div>
                )}
              </div>

              {/* Timer */}
              <div className="recording-timer">
                {formatTime(recordingTime)}
                {recordingTime >= MAX_RECORDING_TIME && (
                  <span className="max-time-warning"> (máximo atingido)</span>
                )}
              </div>

              {/* Playback section */}
              {audioBlob && (
                <div className="playback-section">
                  <div className="playback-controls">
                    <button
                      onClick={togglePlayback}
                      className="playback-button"
                    >
                      <i className={`fas fa-${isPlaying ? 'pause' : 'play'}`}></i>
                    </button>
                    
                    <div className="playback-info">
                      <span>Reprodução: {formatTime(playbackTime)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={deleteRecording}
                    className="delete-button"
                    title="Gravar novamente"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              )}

              {/* Hidden audio element */}
              <audio ref={audioRef} />
            </>
          )}
        </div>

        <div className="audio-recorder-footer">
          {!audioBlob ? (
            // Recording controls
            <div className="recording-controls">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="record-button"
                  disabled={error}
                >
                  <i className="fas fa-circle"></i>
                  Gravar
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="stop-button"
                >
                  <i className="fas fa-stop"></i>
                  Parar
                </button>
              )}
              
              <button
                onClick={onCancel}
                className="cancel-button"
              >
                Cancelar
              </button>
            </div>
          ) : (
            // Send controls
            <div className="send-controls">
              <button
                onClick={deleteRecording}
                className="record-again-button"
              >
                <i className="fas fa-microphone"></i>
                Gravar Novamente
              </button>
              
              <button
                onClick={sendRecording}
                className="send-button"
              >
                <i className="fas fa-paper-plane"></i>
                Enviar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioRecorder;
