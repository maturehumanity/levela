"use client"

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  MessageCircle,
  X,
  Phone,
  PhoneOff,
  Video,
  Mic,
  MicOff,
  Camera,
  CameraOff,
  Loader2,
} from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/contexts/LanguageContext';

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  is_edited: boolean | null;
  sender: {
    id: string;
    username: string | null;
    full_name: string | null;
    avatar_url: string | null;
  };
}

type CallMode = 'voice' | 'video';
type CallScope = 'direct' | 'group';
type CallStatus = 'idle' | 'ringing' | 'calling' | 'connecting' | 'connected';
type CallRole = 'caller' | 'participant';

interface CallSession {
  callId: string;
  mode: CallMode;
  scope: CallScope;
  role: CallRole;
  hostId: string;
  hostName: string;
  targetProfileId: string | null;
}

interface IncomingCall {
  callId: string;
  fromProfileId: string;
  fromName: string;
  mode: CallMode;
  scope: CallScope;
  hostId: string;
  targetProfileId: string | null;
}

interface CallSignalPayload {
  type: 'invite' | 'join' | 'decline' | 'offer' | 'answer' | 'ice-candidate' | 'hangup';
  callId: string;
  fromProfileId: string;
  fromName: string;
  mode?: CallMode;
  scope?: CallScope;
  hostId?: string;
  toProfileId?: string | null;
  reason?: 'busy' | 'declined' | 'permissions' | 'timeout' | 'end-call' | 'leave' | 'full';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

const CALL_CHANNEL_NAME = 'messaging-calls';
const CALL_SIGNAL_EVENT = 'signal';
const CALL_RING_TIMEOUT_MS = 30_000;
const GROUP_VIDEO_MAX_PARTICIPANTS = 4;
const GROUP_VOICE_MAX_PARTICIPANTS = 8;
const RTC_CONFIGURATION: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

const getRandomId = () =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `call-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getGroupParticipantCap = (mode: CallMode) =>
  mode === 'video' ? GROUP_VIDEO_MAX_PARTICIPANTS : GROUP_VOICE_MAX_PARTICIPANTS;

function MediaVideo({
  stream,
  muted,
  className,
}: {
  stream: MediaStream | null;
  muted?: boolean;
  className: string;
}) {
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  if (!stream) return null;

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
}

function MediaAudio({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  return <audio ref={ref} autoPlay />;
}

export function ChatBar({ initialExpanded = false }: { initialExpanded?: boolean } = {}) {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [loading, setLoading] = useState(true);
  const [selectedCallScope, setSelectedCallScope] = useState<CallScope>('direct');
  const [selectedTargetProfileId, setSelectedTargetProfileId] = useState('');
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [callMode, setCallMode] = useState<CallMode | null>(null);
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [peerNames, setPeerNames] = useState<Record<string, string>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const callChannelRef = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const activeCallRef = useRef<CallSession | null>(null);
  const incomingCallRef = useRef<IncomingCall | null>(null);
  const callStatusRef = useRef<CallStatus>('idle');
  const ringTimeoutRef = useRef<number | null>(null);

  const currentUserName = profile?.full_name || profile?.username || t('chatBar.anonymous');

  const callTargets = useMemo(() => {
    const byId = new Map<string, string>();

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (!message.sender_id || message.sender_id === profile?.id) continue;
      if (byId.has(message.sender_id)) continue;
      byId.set(
        message.sender_id,
        message.sender?.full_name || message.sender?.username || t('chatBar.anonymous')
      );
    }

    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [messages, profile?.id, t]);

  const remoteStreamEntries = useMemo(
    () => Object.entries(remoteStreams),
    [remoteStreams]
  );

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    callStatusRef.current = callStatus;
  }, [callStatus]);

  useEffect(() => {
    if (selectedCallScope !== 'direct') return;
    if (callTargets.length === 0) {
      if (selectedTargetProfileId) setSelectedTargetProfileId('');
      return;
    }

    const selectedStillExists = callTargets.some((target) => target.id === selectedTargetProfileId);
    if (!selectedStillExists) {
      setSelectedTargetProfileId(callTargets[0].id);
    }
  }, [selectedCallScope, callTargets, selectedTargetProfileId]);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    void fetchMessages();
    const unsubscribeMessages = subscribeToMessages();
    const unsubscribeCallSignals = subscribeToCallSignals();

    return () => {
      unsubscribeMessages();
      unsubscribeCallSignals();
      void hangupActiveCall(false);
    };
  }, [profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const clearRingTimeout = () => {
    if (ringTimeoutRef.current !== null) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  };

  const closePeerConnection = (peerId: string) => {
    const peerConnection = peerConnectionsRef.current.get(peerId);
    if (!peerConnection) return;

    peerConnection.onicecandidate = null;
    peerConnection.ontrack = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.close();
    peerConnectionsRef.current.delete(peerId);
    pendingIceCandidatesRef.current.delete(peerId);
  };

  const removePeerFromCall = (peerId: string) => {
    closePeerConnection(peerId);

    setRemoteStreams((prev) => {
      if (!prev[peerId]) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });

    setPeerNames((prev) => {
      if (!prev[peerId]) return prev;
      const next = { ...prev };
      delete next[peerId];
      return next;
    });

    const session = activeCallRef.current;
    if (!session) return;

    if (peerConnectionsRef.current.size === 0) {
      if (session.scope === 'direct') {
        toast.info(t('chatBar.calls.ended'));
        resetCallState();
      } else if (callStatusRef.current !== 'calling') {
        setCallStatus('connecting');
      }
    }
  };

  const closeAllPeerConnections = () => {
    for (const peerId of peerConnectionsRef.current.keys()) {
      closePeerConnection(peerId);
    }
    setRemoteStreams({});
    setPeerNames({});
  };

  const releaseMediaTracks = () => {
    if (localStreamRef.current) {
      for (const track of localStreamRef.current.getTracks()) {
        track.stop();
      }
    }
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const resetCallState = () => {
    clearRingTimeout();
    closeAllPeerConnections();
    releaseMediaTracks();
    setActiveCall(null);
    setIncomingCall(null);
    setCallStatus('idle');
    setCallMode(null);
    setIsMuted(false);
    setIsCameraEnabled(true);
  };

  const sendCallSignal = async (payload: CallSignalPayload) => {
    const channel = callChannelRef.current;
    if (!channel) return;

    const result = await channel.send({
      type: 'broadcast',
      event: CALL_SIGNAL_EVENT,
      payload,
    });

    if (result !== 'ok') {
      console.error('ChatBar: call signal send failed:', payload.type, result);
    }
  };

  const queueIceCandidate = (peerId: string, candidate: RTCIceCandidateInit) => {
    const queue = pendingIceCandidatesRef.current.get(peerId) || [];
    queue.push(candidate);
    pendingIceCandidatesRef.current.set(peerId, queue);
  };

  const flushPendingIceCandidates = async (peerId: string, peerConnection: RTCPeerConnection) => {
    const queue = pendingIceCandidatesRef.current.get(peerId) || [];
    pendingIceCandidatesRef.current.delete(peerId);

    for (const candidate of queue) {
      try {
        await peerConnection.addIceCandidate(candidate);
      } catch (error) {
        console.error('ChatBar: Failed to flush queued ICE candidate:', error);
      }
    }
  };

  const ensureLocalStream = async (mode: CallMode) => {
    if (localStreamRef.current) return localStreamRef.current;
    if (!navigator?.mediaDevices?.getUserMedia) {
      throw new Error('getUserMedia not available');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
      video:
        mode === 'video'
          ? {
              facingMode: 'user',
              width: { ideal: 960 },
              height: { ideal: 540 },
            }
          : false,
    });

    localStreamRef.current = stream;
    setLocalStream(stream);
    setIsMuted(false);
    setIsCameraEnabled(mode === 'video');
    return stream;
  };

  const addStreamTracks = (peerConnection: RTCPeerConnection, stream: MediaStream) => {
    const existingTrackIds = new Set(
      peerConnection
        .getSenders()
        .map((sender) => sender.track?.id)
        .filter((trackId): trackId is string => Boolean(trackId))
    );

    for (const track of stream.getTracks()) {
      if (existingTrackIds.has(track.id)) continue;
      peerConnection.addTrack(track, stream);
    }
  };

  const ensurePeerConnection = async (session: CallSession, peerId: string, peerName: string) => {
    const existing = peerConnectionsRef.current.get(peerId);
    if (existing) return existing;

    const peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate || !profile?.id) return;
      void sendCallSignal({
        type: 'ice-candidate',
        callId: session.callId,
        fromProfileId: profile.id,
        fromName: currentUserName,
        toProfileId: peerId,
        candidate: event.candidate.toJSON(),
      });
    };

    peerConnection.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      setRemoteStreams((prev) =>
        prev[peerId] === stream ? prev : { ...prev, [peerId]: stream }
      );
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        clearRingTimeout();
        setCallStatus('connected');
        return;
      }

      if (state === 'failed' || state === 'disconnected' || state === 'closed') {
        removePeerFromCall(peerId);
      }
    };

    peerConnectionsRef.current.set(peerId, peerConnection);
    setPeerNames((prev) => ({ ...prev, [peerId]: peerName }));

    const stream = await ensureLocalStream(session.mode);
    addStreamTracks(peerConnection, stream);

    return peerConnection;
  };

  const createOfferForPeer = async (session: CallSession, peerId: string, peerName: string) => {
    const peerConnection = await ensurePeerConnection(session, peerId, peerName);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await sendCallSignal({
      type: 'offer',
      callId: session.callId,
      fromProfileId: profile?.id || '',
      fromName: currentUserName,
      toProfileId: peerId,
      mode: session.mode,
      scope: session.scope,
      hostId: session.hostId,
      sdp: offer,
    });
  };

  const handleCallSignal = async (signal: CallSignalPayload) => {
    if (!profile?.id) return;
    if (signal.fromProfileId === profile.id) return;
    if (signal.toProfileId && signal.toProfileId !== profile.id) return;

    if (signal.type === 'invite') {
      const scope: CallScope = signal.scope === 'group' ? 'group' : 'direct';
      const mode: CallMode = signal.mode === 'video' ? 'video' : 'voice';

      if (callStatusRef.current !== 'idle' || activeCallRef.current || incomingCallRef.current) {
        await sendCallSignal({
          type: 'decline',
          callId: signal.callId,
          fromProfileId: profile.id,
          fromName: currentUserName,
          toProfileId: signal.fromProfileId,
          reason: 'busy',
        });
        return;
      }

      setIncomingCall({
        callId: signal.callId,
        fromProfileId: signal.fromProfileId,
        fromName: signal.fromName || t('chatBar.anonymous'),
        mode,
        scope,
        hostId: signal.hostId || signal.fromProfileId,
        targetProfileId: signal.toProfileId || null,
      });
      setCallMode(mode);
      setCallStatus('ringing');
      setIsExpanded(true);
      toast.info(
        t('chatBar.calls.incomingToast', {
          name: signal.fromName || t('chatBar.anonymous'),
          type: mode === 'video' ? t('chatBar.calls.kindVideo') : t('chatBar.calls.kindVoice'),
        })
      );
      return;
    }

    if (signal.type === 'decline') {
      const session = activeCallRef.current;
      if (!session || session.callId !== signal.callId) return;

      if (session.scope === 'direct' && session.role === 'caller') {
        const messageKey = signal.reason === 'busy' ? 'chatBar.calls.targetBusy' : 'chatBar.calls.targetDeclined';
        toast.info(t(messageKey));
        resetCallState();
        return;
      }

      if (session.scope === 'group' && signal.reason === 'full') {
        toast.info(
          t('chatBar.calls.groupFull', {
            count: getGroupParticipantCap(session.mode),
          })
        );
        resetCallState();
        return;
      }

      return;
    }

    if (signal.type === 'join') {
      const session = activeCallRef.current;
      if (!session || session.callId !== signal.callId) return;

      if (session.scope === 'direct' && session.targetProfileId && signal.fromProfileId !== session.targetProfileId) {
        return;
      }

      if (session.scope === 'group' && !peerConnectionsRef.current.has(signal.fromProfileId)) {
        const participantCount = peerConnectionsRef.current.size + 1;
        const participantCap = getGroupParticipantCap(session.mode);

        if (participantCount >= participantCap) {
          await sendCallSignal({
            type: 'decline',
            callId: session.callId,
            fromProfileId: profile.id,
            fromName: currentUserName,
            toProfileId: signal.fromProfileId,
            reason: 'full',
          });
          return;
        }
      }

      const shouldCreateOffer =
        session.role === 'caller' || profile.id < signal.fromProfileId;

      if (!shouldCreateOffer) {
        return;
      }

      clearRingTimeout();
      setCallStatus('connecting');
      await createOfferForPeer(
        session,
        signal.fromProfileId,
        signal.fromName || t('chatBar.anonymous')
      );
      return;
    }

    if (signal.type === 'offer') {
      const session = activeCallRef.current;
      if (!session || session.callId !== signal.callId || !signal.sdp) return;

      try {
        setCallStatus('connecting');
        const peerConnection = await ensurePeerConnection(
          session,
          signal.fromProfileId,
          signal.fromName || t('chatBar.anonymous')
        );

        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushPendingIceCandidates(signal.fromProfileId, peerConnection);

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await sendCallSignal({
          type: 'answer',
          callId: session.callId,
          fromProfileId: profile.id,
          fromName: currentUserName,
          toProfileId: signal.fromProfileId,
          mode: session.mode,
          scope: session.scope,
          hostId: session.hostId,
          sdp: answer,
        });
      } catch (error) {
        console.error('ChatBar: Failed to handle offer:', error);
      }
      return;
    }

    if (signal.type === 'answer') {
      if (!signal.sdp) return;
      const session = activeCallRef.current;
      if (!session || session.callId !== signal.callId) return;
      const peerConnection = peerConnectionsRef.current.get(signal.fromProfileId);
      if (!peerConnection) return;

      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushPendingIceCandidates(signal.fromProfileId, peerConnection);
      } catch (error) {
        console.error('ChatBar: Failed to handle answer:', error);
      }
      return;
    }

    if (signal.type === 'ice-candidate') {
      if (!signal.candidate) return;
      const peerConnection = peerConnectionsRef.current.get(signal.fromProfileId);

      if (!peerConnection || !peerConnection.remoteDescription) {
        queueIceCandidate(signal.fromProfileId, signal.candidate);
        return;
      }

      try {
        await peerConnection.addIceCandidate(signal.candidate);
      } catch (error) {
        console.error('ChatBar: Failed to add ICE candidate:', error);
      }
      return;
    }

    if (signal.type === 'hangup') {
      if (incomingCallRef.current?.callId === signal.callId) {
        setIncomingCall(null);
        setCallStatus('idle');
        setCallMode(null);
        return;
      }

      const session = activeCallRef.current;
      if (!session || session.callId !== signal.callId) return;

      if (session.scope === 'group' && signal.reason === 'leave' && signal.fromProfileId !== session.hostId) {
        removePeerFromCall(signal.fromProfileId);
        toast.info(
          t('chatBar.calls.participantLeft', {
            name: signal.fromName || t('chatBar.anonymous'),
          })
        );
        return;
      }

      toast.info(t('chatBar.calls.ended'));
      resetCallState();
    }
  };

  const subscribeToCallSignals = () => {
    if (!profile?.id) return () => {};

    const channel = supabase.channel(CALL_CHANNEL_NAME);
    callChannelRef.current = channel;

    channel
      .on('broadcast', { event: CALL_SIGNAL_EVENT }, ({ payload }) => {
        void handleCallSignal(payload as CallSignalPayload);
      })
      .subscribe();

    return () => {
      if (callChannelRef.current === channel) {
        callChannelRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  };

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          content,
          created_at,
          sender_id,
          is_edited,
          sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
        `)
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('ChatBar: Error fetching messages:', error);
        setMessages([]);
      } else {
        setMessages(data ?? []);
      }
    } catch (error) {
      console.error('ChatBar: Unexpected fetch error:', error);
      setMessages([]);
    }

    setLoading(false);
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          supabase
            .from('messages')
            .select(`
              id,
              content,
              created_at,
              sender_id,
              is_edited,
              sender:profiles!messages_sender_id_fkey(id, username, full_name, avatar_url)
            `)
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) {
                setMessages((prev) => [...prev, data as Message]);
              }
            });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = (event?: React.KeyboardEvent<HTMLInputElement> | React.MouseEvent<HTMLButtonElement>) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    const sender = profile || {
      id: `anonymous-${Date.now()}`,
      username: 'anonymous',
      full_name: t('chatBar.anonymous'),
      avatar_url: null,
    };

    setNewMessage('');

    const localMessage: Message = {
      id: `local-${Date.now()}-${Math.random()}`,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
      sender_id: sender.id,
      is_edited: null,
      sender: {
        id: sender.id,
        username: sender.username,
        full_name: sender.full_name,
        avatar_url: sender.avatar_url,
      },
    };

    setMessages((prev) => [...prev, localMessage]);
    setIsExpanded(true);

    if (profile?.id) {
      void sendToDatabase(localMessage, trimmedMessage);
    }
  };

  const sendToDatabase = async (messageObj: Message, content: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: messageObj.sender_id,
          content,
        });

      if (error) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageObj.id ? { ...msg, id: `failed-${msg.id}` } : msg
          )
        );
      } else {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageObj.id ? { ...msg, id: `sent-${Date.now()}` } : msg
          )
        );
      }
    } catch (error) {
      console.error('ChatBar: send message failed:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageObj.id ? { ...msg, id: `failed-${msg.id}` } : msg
        )
      );
    }
  };

  const retryMessage = async (messageId: string) => {
    const message = messages.find((candidate) => candidate.id === messageId);
    if (!message) return;

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          sender_id: message.sender_id,
          content: message.content,
        });

      if (error) return;

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, id: `sent-${Date.now()}` } : msg
        )
      );
    } catch (error) {
      console.error('ChatBar: retry failed:', error);
    }
  };

  const startCall = async (mode: CallMode) => {
    if (!profile?.id) {
      toast.error(t('chatBar.calls.signInRequired'));
      return;
    }

    if (callStatusRef.current !== 'idle' || activeCallRef.current || incomingCallRef.current) {
      toast.info(t('chatBar.calls.finishCurrent'));
      return;
    }

    const scope = selectedCallScope;
    const targetProfileId = scope === 'direct' ? selectedTargetProfileId : null;

    if (scope === 'direct' && !targetProfileId) {
      toast.info(t('chatBar.calls.selectTarget'));
      return;
    }

    const session: CallSession = {
      callId: getRandomId(),
      mode,
      scope,
      role: 'caller',
      hostId: profile.id,
      hostName: currentUserName,
      targetProfileId,
    };

    try {
      await ensureLocalStream(mode);
    } catch (error) {
      console.error('ChatBar: media permission error while starting call:', error);
      toast.error(t('chatBar.calls.permissionsError'));
      resetCallState();
      return;
    }

    setCallMode(mode);
    setCallStatus('calling');
    setActiveCall(session);
    setIncomingCall(null);
    setIsExpanded(true);
    setPeerNames({});

    clearRingTimeout();
    if (scope === 'direct') {
      ringTimeoutRef.current = window.setTimeout(() => {
        const currentCall = activeCallRef.current;
        if (!currentCall || currentCall.callId !== session.callId || callStatusRef.current !== 'calling') return;
        toast.info(t('chatBar.calls.noAnswer'));
        void hangupActiveCall(true, 'timeout');
      }, CALL_RING_TIMEOUT_MS);
    }

    await sendCallSignal({
      type: 'invite',
      callId: session.callId,
      fromProfileId: profile.id,
      fromName: currentUserName,
      mode: session.mode,
      scope: session.scope,
      hostId: session.hostId,
      toProfileId: session.scope === 'direct' ? session.targetProfileId : null,
    });
  };

  const acceptIncomingCall = async () => {
    if (!profile?.id || !incomingCallRef.current) return;

    const invite = incomingCallRef.current;
    const session: CallSession = {
      callId: invite.callId,
      mode: invite.mode,
      scope: invite.scope,
      role: 'participant',
      hostId: invite.hostId,
      hostName: invite.fromName,
      targetProfileId: invite.scope === 'direct' ? invite.fromProfileId : null,
    };

    try {
      await ensureLocalStream(invite.mode);
      setIncomingCall(null);
      setCallMode(invite.mode);
      setCallStatus('connecting');
      setActiveCall(session);
      setPeerNames({
        [invite.fromProfileId]: invite.fromName,
      });

      await sendCallSignal({
        type: 'join',
        callId: invite.callId,
        fromProfileId: profile.id,
        fromName: currentUserName,
        mode: invite.mode,
        scope: invite.scope,
        hostId: invite.hostId,
        toProfileId: invite.scope === 'direct' ? invite.fromProfileId : null,
      });
    } catch (error) {
      console.error('ChatBar: accept call failed:', error);
      toast.error(t('chatBar.calls.permissionsError'));
      await sendCallSignal({
        type: 'decline',
        callId: invite.callId,
        fromProfileId: profile.id,
        fromName: currentUserName,
        toProfileId: invite.fromProfileId,
        reason: 'permissions',
      });
      resetCallState();
    }
  };

  const declineIncomingCall = async () => {
    if (!profile?.id || !incomingCallRef.current) return;

    await sendCallSignal({
      type: 'decline',
      callId: incomingCallRef.current.callId,
      fromProfileId: profile.id,
      fromName: currentUserName,
      toProfileId: incomingCallRef.current.fromProfileId,
      reason: 'declined',
    });

    setIncomingCall(null);
    setCallStatus('idle');
    setCallMode(null);
  };

  const hangupActiveCall = async (
    notifyPeers = true,
    reasonOverride?: 'timeout' | 'end-call' | 'leave'
  ) => {
    const session = activeCallRef.current;

    if (notifyPeers && profile?.id && session) {
      const reason =
        reasonOverride ||
        (session.scope === 'group' && session.role !== 'caller' ? 'leave' : 'end-call');

      await sendCallSignal({
        type: 'hangup',
        callId: session.callId,
        fromProfileId: profile.id,
        fromName: currentUserName,
        scope: session.scope,
        hostId: session.hostId,
        toProfileId: session.scope === 'direct' ? session.targetProfileId : null,
        reason,
      });
    }

    resetCallState();
  };

  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsMuted(!audioTrack.enabled);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCameraEnabled(videoTrack.enabled);
  };

  const getInitials = (name?: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatTime = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const canStartCall =
    Boolean(profile?.id) &&
    callStatus === 'idle' &&
    (selectedCallScope === 'group' || Boolean(selectedTargetProfileId));

  const isCallLive = callStatus === 'connecting' || callStatus === 'connected';
  const callTypeLabel = callMode === 'video' ? t('chatBar.calls.kindVideo') : t('chatBar.calls.kindVoice');
  const activePeerCount = Object.keys(peerNames).length;
  const callStatusLabel =
    callStatus === 'calling'
      ? t('chatBar.calls.calling', { type: callTypeLabel })
      : callStatus === 'ringing'
        ? t('chatBar.calls.incomingStatus', { type: callTypeLabel })
        : callStatus === 'connecting'
          ? t('chatBar.calls.connecting')
          : callStatus === 'connected'
            ? t('chatBar.calls.connected', { type: callTypeLabel })
            : '';

  if (!user) {
    console.log('ChatBar: No user; rendering chat in local-only mode');
  }

  return (
    <div className="fixed bottom-28 right-4 z-40 max-w-md w-full">
      <AnimatePresence>
        {isExpanded ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-background border border-border rounded-lg shadow-glow w-full"
          >
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-semibold text-foreground">{t('chatBar.title')}</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {callStatus === 'idle' && (
              <div className="px-3 py-2 border-b border-border bg-muted/20 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground whitespace-nowrap">
                    {t('chatBar.calls.scopeLabel')}
                  </label>
                  <select
                    className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1"
                    value={selectedCallScope}
                    onChange={(event) => setSelectedCallScope(event.target.value as CallScope)}
                    disabled={!profile?.id}
                  >
                    <option value="direct">{t('chatBar.calls.scopeDirect')}</option>
                    <option value="group">{t('chatBar.calls.scopeGroup')}</option>
                  </select>
                </div>

                {selectedCallScope === 'direct' && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-muted-foreground whitespace-nowrap">
                      {t('chatBar.calls.targetLabel')}
                    </label>
                    <select
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1"
                      value={selectedTargetProfileId}
                      onChange={(event) => setSelectedTargetProfileId(event.target.value)}
                      disabled={!profile?.id || callTargets.length === 0}
                    >
                      {callTargets.length === 0 ? (
                        <option value="">{t('chatBar.calls.noTargets')}</option>
                      ) : (
                        callTargets.map((target) => (
                          <option key={target.id} value={target.id}>
                            {target.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 flex-1"
                    onClick={() => void startCall('voice')}
                    disabled={!canStartCall}
                  >
                    <Phone className="h-4 w-4 mr-1" />
                    {t('chatBar.calls.startVoice')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 flex-1"
                    onClick={() => void startCall('video')}
                    disabled={!canStartCall}
                  >
                    <Video className="h-4 w-4 mr-1" />
                    {t('chatBar.calls.startVideo')}
                  </Button>
                </div>

                {selectedCallScope === 'group' && (
                  <p className="text-[11px] text-muted-foreground">
                    {t('chatBar.calls.capHint', {
                      video: GROUP_VIDEO_MAX_PARTICIPANTS,
                      voice: GROUP_VOICE_MAX_PARTICIPANTS,
                    })}
                  </p>
                )}
              </div>
            )}

            {(callStatus !== 'idle' || incomingCall) && (
              <div className="px-3 py-2 border-b border-border bg-muted/30 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-foreground font-medium truncate">
                    {incomingCall
                      ? t('chatBar.calls.incomingFrom', { name: incomingCall.fromName })
                      : callStatusLabel}
                  </p>
                  {(callStatus === 'calling' || isCallLive) && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => void hangupActiveCall(true)}
                    >
                      <PhoneOff className="h-3.5 w-3.5 mr-1" />
                      {t('chatBar.calls.end')}
                    </Button>
                  )}
                </div>

                {!incomingCall && activeCall && (
                  <p className="text-xs text-muted-foreground">
                    {t('chatBar.calls.participantsCount', { count: activePeerCount + 1 })}
                  </p>
                )}

                {incomingCall && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      className="h-8"
                      onClick={() => void acceptIncomingCall()}
                    >
                      {incomingCall.mode === 'video' ? (
                        <Video className="h-4 w-4 mr-1" />
                      ) : (
                        <Phone className="h-4 w-4 mr-1" />
                      )}
                      {t('chatBar.calls.accept')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => void declineIncomingCall()}
                    >
                      {t('chatBar.calls.decline')}
                    </Button>
                  </div>
                )}

                {isCallLive && (
                  <div className="space-y-2">
                    {callMode === 'video' ? (
                      <div className="grid grid-cols-2 gap-2">
                        {remoteStreamEntries.map(([peerId, stream]) => (
                          <div
                            key={peerId}
                            className="relative rounded-md overflow-hidden bg-black/80 h-24"
                          >
                            <MediaVideo
                              stream={stream}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute left-1 bottom-1 text-[10px] px-1 rounded bg-black/60 text-white">
                              {peerNames[peerId] || t('chatBar.anonymous')}
                            </span>
                          </div>
                        ))}

                        <div className="relative rounded-md overflow-hidden bg-black/90 border border-primary/40 h-24">
                          <MediaVideo
                            stream={localStream}
                            muted
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute left-1 bottom-1 text-[10px] px-1 rounded bg-black/60 text-white">
                            {t('chatBar.calls.you')}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {remoteStreamEntries.map(([peerId, stream]) => (
                          <div key={peerId}>
                            <MediaAudio stream={stream} />
                            <p className="text-xs text-muted-foreground">
                              {peerNames[peerId] || t('chatBar.anonymous')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2"
                        onClick={toggleMute}
                      >
                        {isMuted ? (
                          <MicOff className="h-4 w-4 mr-1" />
                        ) : (
                          <Mic className="h-4 w-4 mr-1" />
                        )}
                        {isMuted ? t('chatBar.calls.unmute') : t('chatBar.calls.mute')}
                      </Button>

                      {callMode === 'video' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2"
                          onClick={toggleCamera}
                        >
                          {isCameraEnabled ? (
                            <Camera className="h-4 w-4 mr-1" />
                          ) : (
                            <CameraOff className="h-4 w-4 mr-1" />
                          )}
                          {isCameraEnabled ? t('chatBar.calls.cameraOn') : t('chatBar.calls.cameraOff')}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {callStatus === 'calling' && (
                  <div className="flex items-center text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    {t('chatBar.calls.waiting')}
                  </div>
                )}
              </div>
            )}

            <ScrollArea className="h-64 p-3" ref={scrollAreaRef}>
              {loading ? (
                <div className="text-center text-muted-foreground py-4">
                  {t('chatBar.loading')}
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-4">
                  <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>{t('chatBar.emptyTitle')}</p>
                  <p className="text-sm">{t('chatBar.emptySubtitle')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-2 ${
                        message.id.startsWith('failed-')
                          ? 'opacity-60'
                          : message.id.startsWith('local-')
                            ? 'opacity-80'
                            : ''
                      }`}
                    >
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={message.sender?.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(message.sender?.full_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="font-medium text-foreground text-sm">
                            {message.sender?.full_name || t('chatBar.anonymous')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTime(message.created_at)}
                          </span>
                        </div>

                        <p className="text-sm text-foreground break-words">
                          {message.content}
                          {message.id.startsWith('failed-') && (
                            <button
                              onClick={() => void retryMessage(message.id)}
                              className="text-xs text-destructive ml-2 hover:text-destructive/80 underline"
                            >
                              {t('chatBar.retry')}
                            </button>
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="p-3 border-t border-border">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={newMessage}
                  onChange={(event) => setNewMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      event.stopPropagation();
                      handleSendMessage();
                    }
                  }}
                  placeholder={t('chatBar.placeholder')}
                  className="flex-1"
                  maxLength={500}
                />
                <Button
                  type="button"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    handleSendMessage();
                  }}
                  disabled={!newMessage.trim()}
                  className="px-3"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex justify-end"
          >
            <Button
              onClick={() => setIsExpanded(true)}
              className="rounded-full shadow-glow h-12 w-12 p-0"
              size="lg"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
