// Cloudflare Realtime SFU implementation
// This replaces the Dyte SDK with direct Cloudflare Realtime API calls

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const useCloudflareRealtimeCall = () => {
  const { currentUser } = useAuth();
  
  // Call state
  const [isInCall, setIsInCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callStatus, setCallStatus] = useState('idle');
  const [callData, setCallData] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  
  // Refs
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const roomIdRef = useRef(null);
  const conversationIdRef = useRef(null);
  const sessionIdRef = useRef(null);
  const tracksRef = useRef(new Map());

  // Initialize Cloudflare Realtime session
  const initializeRealtimeSession = useCallback(async (appId, roomId) => {
    try {
      console.log('🚀 Initializing Cloudflare Realtime session for room:', roomId);
      
      // Create new session
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      if (!response.ok) {
        throw new Error(`Failed to create session: ${response.statusText}`);
      }

      const sessionData = await response.json();
      sessionIdRef.current = sessionData.sessionId;
      
      console.log('✅ Cloudflare Realtime session created:', sessionData.sessionId);
      return sessionData;
    } catch (error) {
      console.error('❌ Error initializing Realtime session:', error);
      throw error;
    }
  }, []);

  // Create WebRTC peer connection
  const createPeerConnection = useCallback(async (appId) => {
    try {
      console.log('🔗 Creating WebRTC peer connection');
      
      const peerConnection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.cloudflare.com:3478' },
          { urls: 'stun:stun.l.google.com:19302' }
        ]
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('🧊 ICE candidate generated');
          // Send ICE candidate to Cloudflare Realtime
          sendIceCandidate(appId, sessionIdRef.current, event.candidate);
        }
      };

      // Handle remote streams
      peerConnection.ontrack = (event) => {
        console.log('📹 Remote track received:', event.track);
        const trackId = `${event.streams[0].id}_${event.track.kind}`;
        
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(trackId, {
            stream: event.streams[0],
            track: event.track,
            kind: event.track.kind
          });
          return newMap;
        });

        // Attach to video element if available
        const videoElement = remoteVideoRefs.current.get(trackId);
        if (videoElement && event.track.kind === 'video') {
          videoElement.srcObject = event.streams[0];
        }
      };

      peerConnectionRef.current = peerConnection;
      return peerConnection;
    } catch (error) {
      console.error('❌ Error creating peer connection:', error);
      throw error;
    }
  }, []);

  // Send ICE candidate to Cloudflare Realtime
  const sendIceCandidate = useCallback(async (appId, sessionId, candidate) => {
    try {
      await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/ice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex,
          sdpMid: candidate.sdpMid
        })
      });
    } catch (error) {
      console.error('❌ Error sending ICE candidate:', error);
    }
  }, []);

  // Add local track to session
  const addLocalTrack = useCallback(async (appId, sessionId, track) => {
    try {
      console.log('📹 Adding local track to session:', track.kind);
      
      // Add track to peer connection
      const sender = peerConnectionRef.current.addTrack(track, localStream);
      
      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send track to Cloudflare Realtime
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/tracks/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add track: ${response.statusText}`);
      }

      const trackData = await response.json();
      tracksRef.current.set(track.id, trackData.trackId);
      
      console.log('✅ Local track added:', trackData.trackId);
      return trackData;
    } catch (error) {
      console.error('❌ Error adding local track:', error);
      throw error;
    }
  }, [localStream]);

  // Subscribe to remote track
  const subscribeToTrack = useCallback(async (appId, sessionId, trackId) => {
    try {
      console.log('👂 Subscribing to remote track:', trackId);
      
      const response = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${appId}/sessions/${sessionId}/tracks/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trackId: trackId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to subscribe to track: ${response.statusText}`);
      }

      const trackData = await response.json();
      
      // Set remote description
      await peerConnectionRef.current.setRemoteDescription({
        type: trackData.type,
        sdp: trackData.sdp
      });
      
      console.log('✅ Subscribed to remote track');
      return trackData;
    } catch (error) {
      console.error('❌ Error subscribing to track:', error);
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

  // Start a call
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

      // Get app ID from backend
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
        throw new Error('Failed to join room');
      }

      const { sfuConfig } = await response.json();
      const appId = sfuConfig.appId;

      // Initialize Cloudflare Realtime session
      await initializeRealtimeSession(appId, roomId);

      // Create peer connection
      await createPeerConnection(appId);

      // Add local tracks
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        
        if (audioTrack) {
          await addLocalTrack(appId, sessionIdRef.current, audioTrack);
        }
        if (videoTrack && callType === 'video') {
          await addLocalTrack(appId, sessionIdRef.current, videoTrack);
        }
      }

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializeRealtimeSession, createPeerConnection, addLocalTrack, localStream]);

  // Join an existing call
  const joinCall = useCallback(async (roomId, conversationId) => {
    try {
      setCallStatus('connecting');
      roomIdRef.current = roomId;
      conversationIdRef.current = conversationId;

      // Get user media
      await getUserMedia();

      // Join room via API
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
        throw new Error('Failed to join room');
      }

      const { sfuConfig } = await response.json();
      const appId = sfuConfig.appId;

      // Initialize Cloudflare Realtime session
      await initializeRealtimeSession(appId, roomId);

      // Create peer connection
      await createPeerConnection(appId);

      // Add local tracks
      if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        const videoTrack = localStream.getVideoTracks()[0];
        
        if (audioTrack) {
          await addLocalTrack(appId, sessionIdRef.current, audioTrack);
        }
        if (videoTrack) {
          await addLocalTrack(appId, sessionIdRef.current, videoTrack);
        }
      }

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error joining call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializeRealtimeSession, createPeerConnection, addLocalTrack, localStream]);

  // End call
  const endCall = useCallback(async () => {
    try {
      console.log('🔚 Ending call');
      
      // Close tracks
      if (sessionIdRef.current && tracksRef.current.size > 0) {
        // Note: You would need the appId here to close tracks
        // This is a simplified version
        tracksRef.current.clear();
      }

      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
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
      sessionIdRef.current = null;

      console.log('✅ Call ended successfully');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [localStream]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, [localStream]);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, [localStream]);

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
    toggleVideo
  };
};

export default useCloudflareRealtimeCall;
