export class P2PManager {
    private peer: RTCPeerConnection;
    private dataChannel: RTCDataChannel | null = null;
    private onConnect: () => void;
    private onData: (data: string | ArrayBuffer) => void;
    private onClose: () => void;

    constructor(
        onConnect: () => void,
        onData: (data: string | ArrayBuffer) => void,
        onClose: () => void
    ) {
        this.onConnect = onConnect;
        this.onData = onData;
        this.onClose = onClose;

        this.peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" },
                { urls: "stun:stun1.l.google.com:19302" },
            ],
        });

        this.peer.oniceconnectionstatechange = () => {
            if (
                this.peer.iceConnectionState === "disconnected" ||
                this.peer.iceConnectionState === "failed" ||
                this.peer.iceConnectionState === "closed"
            ) {
                this.onClose();
            }
        };

        this.peer.ondatachannel = (event) => {
            this.setupDataChannel(event.channel);
        };
    }

    private setupDataChannel(channel: RTCDataChannel) {
        this.dataChannel = channel;
        this.dataChannel.onopen = () => {
            this.onConnect();
        };
        this.dataChannel.onclose = () => {
            this.onClose();
        };
        this.dataChannel.onmessage = (event) => {
            this.onData(event.data);
        };
    }

    public async createOffer(): Promise<string> {
        const channel = this.peer.createDataChannel("file-transfer");
        this.setupDataChannel(channel);

        const offer = await this.peer.createOffer();
        await this.peer.setLocalDescription(offer);

        await this.waitForIceGathering();

        return JSON.stringify(this.peer.localDescription);
    }

    public async createAnswer(offerStr: string): Promise<string> {
        const offer = JSON.parse(offerStr);
        await this.peer.setRemoteDescription(offer);

        const answer = await this.peer.createAnswer();
        await this.peer.setLocalDescription(answer);

        await this.waitForIceGathering();

        return JSON.stringify(this.peer.localDescription);
    }

    public async setAnswer(answerStr: string) {
        const answer = JSON.parse(answerStr);
        await this.peer.setRemoteDescription(answer);
    }

    public send(data: string | ArrayBuffer) {
        if (this.dataChannel && this.dataChannel.readyState === "open") {
            if (typeof data === 'string') {
                this.dataChannel.send(data);
            } else {
                this.dataChannel.send(data);
            }
        } else {
            console.warn("Data channel not open, cannot send");
        }
    }

    public close() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        this.peer.close();
    }

    private waitForIceGathering(): Promise<void> {
        return new Promise((resolve) => {
            if (this.peer.iceGatheringState === "complete") {
                resolve();
            } else {
                const checkState = () => {
                    if (this.peer.iceGatheringState === "complete") {
                        this.peer.removeEventListener("icegatheringstatechange", checkState);
                        resolve();
                    }
                };
                this.peer.addEventListener("icegatheringstatechange", checkState);
            }
        });
    }
}
