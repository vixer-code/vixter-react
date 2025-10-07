// Example usage of the new Cloudflare Realtime hook
// Replace the old useRealtimeKitCall with useCloudflareRealtimeCall

import React, { useState, useEffect } from 'react';
import useCloudflareRealtimeCall from '../hooks/useCloudflareRealtimeCall';

const CallInterface = ({ conversation, onClose }) => {
  const {
    isInCall,
    isCallActive,
    isMuted,
    isVideoEnabled,
    callStatus,
    localStream,
    remoteStreams,
    localVideoRef,
    remoteVideoRefs,
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo
  } = useCloudflareRealtimeCall();

  const [isStarting, setIsStarting] = useState(false);

  const handleStartCall = async () => {
    if (!conversation) return;
    
    setIsStarting(true);
    try {
      const otherUserId = conversation.participants.find(p => p !== currentUser.uid);
      await startCall(conversation.id, otherUserId, 'video');
    } catch (error) {
      console.error('Failed to start call:', error);
    } finally {
      setIsStarting(false);
    }
  };

  const handleEndCall = () => {
    endCall();
    onClose?.();
  };

  return (
    <div className="call-interface">
      <div className="call-status">
        Status: {callStatus}
        {isCallActive && <span className="active-indicator">●</span>}
      </div>

      {/* Local Video */}
      <div className="local-video">
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: '200px', height: '150px' }}
        />
      </div>

      {/* Remote Videos */}
      <div className="remote-videos">
        {Array.from(remoteStreams.values()).map((streamData, index) => (
          <video
            key={index}
            ref={el => {
              if (el) {
                remoteVideoRefs.current.set(`${streamData.stream.id}_${streamData.kind}`, el);
              }
            }}
            autoPlay
            playsInline
            style={{ width: '300px', height: '200px' }}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="call-controls">
        <button onClick={toggleMute} className={isMuted ? 'muted' : ''}>
          {isMuted ? '🔇' : '🎤'}
        </button>
        <button onClick={toggleVideo} className={!isVideoEnabled ? 'disabled' : ''}>
          {isVideoEnabled ? '📹' : '📷'}
        </button>
        <button onClick={handleEndCall} className="end-call">
          📞
        </button>
      </div>

      {/* Start Call Button */}
      {!isInCall && (
        <button 
          onClick={handleStartCall} 
          disabled={isStarting}
          className="start-call"
        >
          {isStarting ? 'Starting...' : 'Start Call'}
        </button>
      )}
    </div>
  );
};

export default CallInterface;
