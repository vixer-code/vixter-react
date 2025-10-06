import { useState, useRef, useCallback, useEffect } from 'react';
import { RealtimeKit } from '@cloudflare/realtimekit';
import { useAuth } from '../contexts/AuthContext';

const useRealtimeCall = () => {
  const { currentUser } = useAuth();
  
  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, connected, ended
  const [callData, setCallData] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  
  // RealtimeKit refs
  const realtimeKitRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const roomIdRef = useRef(null);
  const conversationIdRef = useRef(null);

  // Initialize RealtimeKit
  const initializeRealtimeKit = useCallback(async (token, roomId) => {
    try {
      console.log('🚀 Initializing RealtimeKit with token and room:', roomId);
      
      // Initialize RealtimeKit with the token
      const realtimeKit = new RealtimeKit({
        token: token,
        roomId: roomId,
        onParticipantJoined: (participant) => {
          console.log('👤 Participant joined:', participant);
          setIsCallActive(true);
          setCallStatus('connected');
        },
        onParticipantLeft: (participant) => {
          console.log('👤 Participant left:', participant);
        },
        onTrackAdded: (track, participant) => {
          console.log('📹 Track added:', track, 'from participant:', participant);
          if (track.kind === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = new MediaStream([track]);
            setRemoteStream(new MediaStream([track]));
          }
        },
        onTrackRemoved: (track, participant) => {
          console.log('📹 Track removed:', track, 'from participant:', participant);
        },
        onError: (error) => {
          console.error('❌ RealtimeKit error:', error);
          setCallStatus('idle');
        }
      });

      realtimeKitRef.current = realtimeKit;
      
      // Start the session
      await realtimeKit.start();
      console.log('✅ RealtimeKit started successfully');
      
      return realtimeKit;
    } catch (error) {
      console.error('❌ Error initializing RealtimeKit:', error);
      throw error;
    }
  }, []);

  // Get user media
  const getUserMedia = useCallback(async (constraints = { video: true, audio: true }) => {
    try {
      console.log('🎥 Requesting user media with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ User media obtained:', stream);
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        console.log('✅ Video source set successfully');
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Start a call using RealtimeKit
  const startCall = useCallback(async (conversationId, otherUserId, callType = 'video') => {
    try {
      setCallStatus('calling');
      setCallData({ conversationId, otherUserId, callType });
      conversationIdRef.current = conversationId;

      // Get user media based on call type
      const constraints = callType === 'video' 
        ? { video: true, audio: true }
        : { video: false, audio: true };
      
      await getUserMedia(constraints);

      // Call backend to create SFU room and get token
      const response = await fetch('https://vixter-react-llyd.vercel.app/api/start-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          callerId: currentUser.uid,
          calleeId: otherUserId,
          callType
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start call');
      }

      const { roomId, callerToken } = await response.json();
      roomIdRef.current = roomId;

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(callerToken, roomId);

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializeRealtimeKit]);

  // Join an existing call
  const joinCall = useCallback(async (roomId, conversationId) => {
    try {
      setCallStatus('connecting');
      roomIdRef.current = roomId;
      conversationIdRef.current = conversationId;

      // Get token for joining the room
      const response = await fetch('https://vixter-react-llyd.vercel.app/api/join-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId: currentUser.uid,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get join token');
      }

      const { token } = await response.json();

      // Get user media
      await getUserMedia();

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(token, roomId);

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error joining call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializeRealtimeKit]);

  // End call
  const endCall = useCallback(async () => {
    try {
      console.log('🔚 Ending RealtimeKit call');
      
      if (realtimeKitRef.current) {
        await realtimeKitRef.current.stop();
        realtimeKitRef.current = null;
      }

      // Stop local media
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }

      // Reset state
      setIsInCall(false);
      setIsCallActive(false);
      setIsMuted(false);
      setIsVideoEnabled(true);
      setIsScreenSharing(false);
      setCallStatus('idle');
      setCallData(null);
      setRemoteStream(null);
      roomIdRef.current = null;
      conversationIdRef.current = null;

      console.log('✅ Call ended successfully');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (realtimeKitRef.current && localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (realtimeKitRef.current && localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share and return to camera
        await getUserMedia();
        setIsScreenSharing(false);
      } else {
        // Start screen share
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Replace video track in RealtimeKit
        if (realtimeKitRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          // RealtimeKit will handle track replacement
          setLocalStream(stream);
          setIsScreenSharing(true);
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [isScreenSharing, getUserMedia]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, [endCall]);

  return {
    // State
    isInCall,
    isCallActive,
    isMuted,
    isVideoEnabled,
    isScreenSharing,
    callStatus,
    callData,
    remoteStream,
    localStream,
    
    // Refs for video elements
    localVideoRef,
    remoteVideoRef,
    
    // Actions
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
};

export default useRealtimeCall;
