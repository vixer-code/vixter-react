import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtimeKitClient } from '@cloudflare/realtimekit-react';

const useCloudflareRealtimeCall = () => {
  const { currentUser } = useAuth();
  const [meeting, initMeeting] = useRealtimeKitClient();
  
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
  
  // Refs for video elements
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const roomIdRef = useRef(null);
  const conversationIdRef = useRef(null);

  // Get RealtimeKit token from backend
  const getRealtimeKitToken = useCallback(async (roomId, conversationId) => {
    try {
      console.log('🔑 Getting RealtimeKit token for room:', roomId);
      console.log('🔑 User ID:', currentUser.uid);
      console.log('🔑 User accountType:', currentUser.accountType);
      console.log('🔑 User object keys:', Object.keys(currentUser));
      console.log('🔑 Conversation ID:', conversationId);
      
      // Determine accountType with fallback
      const userAccountType = currentUser.accountType || currentUser.type || 'client';
      console.log('🔑 Final accountType to send:', userAccountType);
      
      const response = await fetch(`https://vixter-react-llyd.vercel.app/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.uid,
          conversationId: conversationId,
          role: 'participant',
          accountType: userAccountType,
          username: currentUser.displayName || currentUser.email || `User ${currentUser.uid.substring(0, 8)}`
        })
      });

      console.log('🔑 Response status:', response.status);
      console.log('🔑 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Response error:', errorText);
        throw new Error(`Failed to get RealtimeKit token: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('🔑 Response data keys:', Object.keys(data));
      console.log('🔑 Token length:', data.token ? data.token.length : 'no token');
      console.log('🔑 Token preview:', data.token ? data.token.substring(0, 50) + '...' : 'no token');
      
      // Check if this is an existing room based on backend response
      const isExistingRoom = data.existingRoom || false;
      const isNewMeeting = data.isNewMeeting || false;
      const sessionType = data.sessionType || 'participant';
      
      console.log('🔍 Meeting/Session Info:');
      console.log('  - Is existing room:', isExistingRoom);
      console.log('  - Is new meeting:', isNewMeeting);
      console.log('  - Session type:', sessionType);
      console.log('  - Meeting ID:', data.meetingId);
      
      return data.token;
    } catch (error) {
      console.error('❌ Error getting RealtimeKit token:', error);
      throw error;
    }
  }, [currentUser.uid]);

  // Set up event listeners when meeting is available
  useEffect(() => {
    if (!meeting) return;

    console.log('🎧 Setting up RealtimeKit event listeners');
    
    // Enable audio and video when meeting becomes available
    const enableMedia = async () => {
      try {
        console.log('🎯 Meeting is now available, enabling audio and video...');
        await meeting.self.setAudioEnabled(true);
        await meeting.self.setVideoEnabled(true);
        console.log('✅ Audio and video enabled for communication');
      } catch (error) {
        console.error('❌ Error enabling audio/video:', error);
      }
    };
    
    enableMedia();

    const handleParticipantJoined = (participant) => {
      console.log('👤 Participant joined:', participant);
      setIsCallActive(true);
      setCallStatus('connected');
    };

    const handleParticipantLeft = (participant) => {
      console.log('👤 Participant left:', participant);
    };

    const handleStreamEnabled = (stream) => {
      console.log('📹 Stream enabled:', stream);
      if (stream.kind === 'video' && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    };

    const handleRemoteStreamEnabled = (participant, stream) => {
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
    };

    const handleRemoteStreamDisabled = (participant, stream) => {
      console.log('📹 Remote stream disabled:', participant, stream);
      const trackId = `${participant.id}_${stream.kind}`;
      
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        newMap.delete(trackId);
        return newMap;
      });
    };

    // Add event listeners
    meeting.participants.on('participantJoined', handleParticipantJoined);
    meeting.participants.on('participantLeft', handleParticipantLeft);
    meeting.self.on('streamEnabled', handleStreamEnabled);
    meeting.participants.on('streamEnabled', handleRemoteStreamEnabled);
    meeting.participants.on('streamDisabled', handleRemoteStreamDisabled);

    // Cleanup function
    return () => {
      meeting.participants.off('participantJoined', handleParticipantJoined);
      meeting.participants.off('participantLeft', handleParticipantLeft);
      meeting.self.off('streamEnabled', handleStreamEnabled);
      meeting.participants.off('streamEnabled', handleRemoteStreamEnabled);
      meeting.participants.off('streamDisabled', handleRemoteStreamDisabled);
    };
  }, [meeting]);

  // Initialize RealtimeKit meeting
  const initializeRealtimeKit = useCallback(async (token, roomId) => {
    try {
      console.log('🚀 Initializing RealtimeKit with token and room:', roomId);
      console.log('🚀 Token type:', typeof token);
      console.log('🚀 Token value:', token);
      console.log('🚀 Token length:', token ? token.length : 'no token');
      console.log('🚀 Token preview:', token ? token.substring(0, 50) + '...' : 'no token');
      
      // Validate token
      if (!token || typeof token !== 'string') {
        throw new Error(`Invalid token: token is ${typeof token}, value: ${token}`);
      }
      
      // Initialize RealtimeKit with the token
      console.log('🎯 Calling initMeeting...');
      await initMeeting({
        authToken: token,
        defaults: {
          audio: true,
          video: true,
        }
      });

      console.log('✅ RealtimeKit initialized successfully');
      console.log('🔍 Meeting object after init:', meeting);
      console.log('🔍 Meeting is null?', meeting === null);
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing RealtimeKit:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Error stack:', error.stack);
      throw error;
    }
  }, [initMeeting]);

  // Start a call using RealtimeKit
  const startCall = useCallback(async (conversationId, otherUserId, callType = 'video') => {
    try {
      setCallStatus('calling');
      setCallData({ conversationId, otherUserId, callType });
      conversationIdRef.current = conversationId;

      // Generate consistent room ID (without timestamp for same conversation)
      const roomId = `call_${conversationId}`;
      roomIdRef.current = roomId;

      console.log('🚀 Creating/joining RealtimeKit room for conversation', conversationId);
      console.log('🚀 Room ID:', roomId);
      console.log('📋 Meeting/Session Concept:');
      console.log('  - Meeting: Persistent container for this conversation');
      console.log('  - Session: Live communication instance (shared by all participants)');

      // Get RealtimeKit token
      const token = await getRealtimeKitToken(roomId, conversationId);

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(token, roomId);

      // Start the communication session
      console.log('🎯 Starting communication session...');
      console.log('🎯 User is joining the live session of the meeting');
      
      // Wait a bit for the meeting object to be available
      console.log('⏳ Waiting for meeting object to be available...');
      let attempts = 0;
      while (!meeting && attempts < 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
        console.log(`⏳ Attempt ${attempts}: meeting is ${meeting ? 'available' : 'null'}`);
      }
      
      if (meeting) {
        console.log('✅ Meeting object is now available');
        // Enable audio and video by default
        await meeting.self.setAudioEnabled(true);
        await meeting.self.setVideoEnabled(true);
        console.log('✅ Audio and video enabled for communication');
        console.log('✅ User is now active in the session');
      } else {
        console.log('⚠️ Meeting object is still null after waiting, audio/video will be enabled when meeting becomes available');
      }

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error starting RealtimeKit call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [getRealtimeKitToken, initializeRealtimeKit]);

  // Join an existing call
  const joinCall = useCallback(async (roomId, conversationId) => {
    try {
      setCallStatus('connecting');
      roomIdRef.current = roomId;
      conversationIdRef.current = conversationId;

      // Get RealtimeKit token
      const token = await getRealtimeKitToken(roomId, conversationId);

      // Initialize RealtimeKit with the token
      await initializeRealtimeKit(token, roomId);

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error joining RealtimeKit call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [getRealtimeKitToken, initializeRealtimeKit]);

  // End call
  const endCall = useCallback(async () => {
    try {
      console.log('🔚 Ending RealtimeKit call');
      
      if (meeting) {
        await meeting.leave();
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
  }, [meeting, localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (meeting) {
      const isCurrentlyMuted = meeting.self.audioEnabled;
      meeting.self.setAudioEnabled(!isCurrentlyMuted);
      setIsMuted(!isCurrentlyMuted);
    }
  }, [meeting]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (meeting) {
      const isCurrentlyVideoEnabled = meeting.self.videoEnabled;
      meeting.self.setVideoEnabled(!isCurrentlyVideoEnabled);
      setIsVideoEnabled(!isCurrentlyVideoEnabled);
    }
  }, [meeting]);

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (meeting) {
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
  }, [meeting, isScreenSharing]);

  // Cleanup on unmount - usando ref para evitar dependências
  const isInCallRef = useRef(isInCall);
  const meetingRef = useRef(meeting);
  
  useEffect(() => {
    isInCallRef.current = isInCall;
  }, [isInCall]);
  
  useEffect(() => {
    meetingRef.current = meeting;
  }, [meeting]);
  
  useEffect(() => {
    return () => {
      // Only cleanup if component is truly unmounting and there's an active call
      if (isInCallRef.current && meetingRef.current) {
        console.log('🧹 Component unmounting, cleaning up call...');
        try {
          meetingRef.current.leave();
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      }
    };
  }, []); // Empty deps - only run on mount/unmount

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
    toggleScreenShare,
    
    // RealtimeKit meeting object
    meeting
  };
};

export default useCloudflareRealtimeCall;