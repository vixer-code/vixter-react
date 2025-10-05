import { useState, useRef, useCallback, useEffect } from 'react';
import { useCentrifugo } from '../contexts/CentrifugoContext';
import { useAuth } from '../contexts/AuthContext';

const useCall = () => {
  const { currentUser } = useAuth();
  const { subscribe, unsubscribe, publish } = useCentrifugo();
  
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
  
  // WebRTC refs
  const peerConnectionRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const callSubscriptionRef = useRef(null);
  const roomIdRef = useRef(null);
  const conversationIdRef = useRef(null);

  // WebRTC configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    const peerConnection = new RTCPeerConnection(rtcConfig);
    
    // Handle incoming remote stream
    peerConnection.ontrack = (event) => {
      console.log('📹 Remote stream received');
      setRemoteStream(event.streams[0]);
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && roomIdRef.current) {
        publish(`call:${roomIdRef.current}`, {
          type: 'ice_candidate',
          candidate: event.candidate,
          userId: currentUser.uid,
          timestamp: Date.now()
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('🔗 Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setIsCallActive(true);
        setCallStatus('connected');
      } else if (peerConnection.connectionState === 'disconnected' || 
                 peerConnection.connectionState === 'failed') {
        endCall();
      }
    };

    peerConnectionRef.current = peerConnection;
    return peerConnection;
  }, [currentUser.uid, publish]);

  // Get user media (camera and microphone)
  const getUserMedia = useCallback(async (constraints = { video: true, audio: true }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Add tracks to peer connection
      if (peerConnectionRef.current) {
        stream.getTracks().forEach(track => {
          peerConnectionRef.current.addTrack(track, stream);
        });
      }

      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw error;
    }
  }, []);

  // Get screen share media
  const getScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      // Replace video track in peer connection
      if (peerConnectionRef.current) {
        const videoTrack = stream.getVideoTracks()[0];
        const sender = peerConnectionRef.current.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      }

      setIsScreenSharing(true);
      return stream;
    } catch (error) {
      console.error('Error accessing screen share:', error);
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

      // Initialize peer connection
      initializePeerConnection();

      // Call backend to create SFU room
      const response = await fetch('/api/start-call', {
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

      // Subscribe to call channel for signaling
      const callChannel = `call:${roomId}`;
      callSubscriptionRef.current = subscribe(callChannel, {
        onMessage: handleCallMessage
      });

      setIsInCall(true);
      setCallStatus('ringing');

    } catch (error) {
      console.error('Error starting call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializePeerConnection, subscribe]);

  // Accept a call
  const acceptCall = useCallback(async (roomId, conversationId) => {
    try {
      setCallStatus('connecting');
      roomIdRef.current = roomId;
      conversationIdRef.current = conversationId;

      // Get user media
      await getUserMedia();

      // Initialize peer connection
      initializePeerConnection();

      // Call backend to get token
      const response = await fetch('/api/accept-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          userId: currentUser.uid,
          conversationId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to accept call');
      }

      // Subscribe to call channel for signaling
      const callChannel = `call:${roomId}`;
      callSubscriptionRef.current = subscribe(callChannel, {
        onMessage: handleCallMessage
      });

      setIsInCall(true);
      setCallStatus('connected');

    } catch (error) {
      console.error('Error accepting call:', error);
      setCallStatus('idle');
      throw error;
    }
  }, [currentUser.uid, getUserMedia, initializePeerConnection, subscribe]);

  // End call
  const endCall = useCallback(async () => {
    try {
      if (roomIdRef.current) {
        // Notify backend to end call
        await fetch('/api/end-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: roomIdRef.current,
            userId: currentUser.uid,
            conversationId: conversationIdRef.current
          })
        });
      }

      // Clean up
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        setLocalStream(null);
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }

      if (callSubscriptionRef.current) {
        unsubscribe(`call:${roomIdRef.current}`);
        callSubscriptionRef.current = null;
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

    } catch (error) {
      console.error('Error ending call:', error);
    }
  }, [currentUser.uid, localStream, unsubscribe]);

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

  // Toggle screen share
  const toggleScreenShare = useCallback(async () => {
    try {
      if (isScreenSharing) {
        // Stop screen share and return to camera
        await getUserMedia();
        setIsScreenSharing(false);
      } else {
        // Start screen share
        await getScreenShare();
      }
    } catch (error) {
      console.error('Error toggling screen share:', error);
    }
  }, [isScreenSharing, getUserMedia, getScreenShare]);

  // Handle incoming call messages
  const handleCallMessage = useCallback((data) => {
    switch (data.type) {
      case 'call_accepted':
        setCallStatus('connected');
        break;
      case 'call_ended':
        endCall();
        break;
      case 'ice_candidate':
        if (peerConnectionRef.current && data.candidate) {
          peerConnectionRef.current.addIceCandidate(data.candidate);
        }
        break;
      case 'offer':
        handleOffer(data.offer);
        break;
      case 'answer':
        handleAnswer(data.answer);
        break;
      default:
        console.log('Unknown call message type:', data.type);
    }
  }, []);

  // Handle WebRTC offer
  const handleOffer = useCallback(async (offer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(offer);
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);

      // Send answer via Centrifugo
      if (roomIdRef.current) {
        publish(`call:${roomIdRef.current}`, {
          type: 'answer',
          answer: answer,
          userId: currentUser.uid,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }, [currentUser.uid, publish]);

  // Handle WebRTC answer
  const handleAnswer = useCallback(async (answer) => {
    if (!peerConnectionRef.current) return;

    try {
      await peerConnectionRef.current.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }, []);

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
    acceptCall,
    endCall,
    toggleMute,
    toggleVideo,
    toggleScreenShare
  };
};

export default useCall;
