import { useState, useRef, useCallback, useEffect } from 'react';
import RealtimeKit from '@cloudflare/realtimekit';
import { useAuth } from '../contexts/AuthContext';

const useRealtimeKitCall = () => {
  const { currentUser } = useAuth();
  
  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, ringing, connected, ended
  const [callData, setCallData] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  
  // RealtimeKit refs
  const meetingRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const roomIdRef = useRef(null);
  const conversationIdRef = useRef(null);

  // Initialize RealtimeKit meeting
  const initializeRealtimeKit = useCallback(async (token, roomId) => {
    try {
      console.log('🚀 Initializing RealtimeKit with token and room:', roomId);
      
      // Initialize RealtimeKit with the token
      const meeting = await RealtimeKit.init({
        authToken: token,
        defaults: {
          audio: true,
          video: true,
        }
      });

      meetingRef.current = meeting;
      
      // Set up event listeners
      meeting.participants.on('participantJoined', (participant) => {
        console.log('👤 Participant joined:', participant);
        setIsCallActive(true);
        setCallStatus('connected');
      });

      meeting.participants.on('participantLeft', (participant) => {
        console.log('👤 Participant left:', participant);
      });

      meeting.self.on('streamEnabled', (stream) => {
        console.log('📹 Stream enabled:', stream);
        if (stream.kind === 'video' && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      });

      meeting.participants.on('streamEnabled', (participant, stream) => {
        console.log('📹 Remote stream enabled:', participant, stream);
        const trackId = `${participant.id}_${stream.kind}`;
        
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(trackId, {
            stream: stream,
            participant: participant,
            kind: stream.kind
          });
          return newMap;
        });

        // Attach to video element if available
        const videoElement = remoteVideoRefs.current.get(trackId);
        if (videoElement) {
          videoElement.srcObject = stream;
        }
      });

      meeting.participants.on('streamDisabled', (participant, stream) => {
        console.log('📹 Remote stream disabled:', participant, stream);
        const trackId = `${participant.id}_${stream.kind}`;
        
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(trackId);
          return newMap;
        });
      });

      // Join the room
      await meeting.join();
      console.log('✅ RealtimeKit started and joined room successfully');
      
      return meeting;
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

      // Generate room ID
      const roomId = `call_${conversationId}_${Date.now()}`;
      roomIdRef.current = roomId;

      // Join room via RealtimeKit API
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          conversationId,
          role: 'participant'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to join RealtimeKit room');
      }

      const { token } = await response.json();

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(token, roomId);

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error starting RealtimeKit call:', error);
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

      // Get user media
      await getUserMedia();

      // Join room via RealtimeKit API
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          conversationId,
          role: 'participant'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to join RealtimeKit room');
      }

      const { token } = await response.json();

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(token, roomId);

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error joining RealtimeKit call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializeRealtimeKit]);

  // End call
  const endCall = useCallback(async () => {
    try {
      console.log('🔚 Ending RealtimeKit call');
      
      if (meetingRef.current) {
        await meetingRef.current.leave();
        meetingRef.current = null;
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
      setRemoteStreams(new Map());
      roomIdRef.current = null;
      conversationIdRef.current = null;

      console.log('✅ RealtimeKit call ended successfully');
    } catch (error) {
      console.error('Error ending RealtimeKit call:', error);
    }
  }, [localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (meetingRef.current) {
      const meeting = meetingRef.current;
      const isCurrentlyMuted = meeting.self.audioEnabled;
      meeting.self.setAudioEnabled(!isCurrentlyMuted);
      setIsMuted(!isCurrentlyMuted);
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (meetingRef.current) {
      const meeting = meetingRef.current;
      const isCurrentlyVideoEnabled = meeting.self.videoEnabled;
      meeting.self.setVideoEnabled(!isCurrentlyVideoEnabled);
      setIsVideoEnabled(!isCurrentlyVideoEnabled);
    }
  }, []);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (meetingRef.current) {
        const meeting = meetingRef.current;
        
        if (isScreenSharing) {
          // Stop screen share
          await meeting.self.setScreenShareEnabled(false);
          setIsScreenSharing(false);
        } else {
          // Start screen share
          await meeting.self.setScreenShareEnabled(true);
          setIsScreenSharing(true);
        }
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [isScreenSharing]);

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
    remoteStreams,
    localStream,
    
    // Refs for video elements
    localVideoRef,
    remoteVideoRefs,
    
    // Actions
    startCall,
    joinCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
};

export default useRealtimeKitCall;
