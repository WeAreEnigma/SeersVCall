/* Let CRA handle linting for sample app */
import React, { Component } from 'react';
import Spinner from 'react-spinner';
import classNames from 'classnames';
// import NetworkTest, { ErrorNames } from 'opentok-network-test-js';
import AccCore from 'opentok-accelerator-core';
import 'opentok-solutions-css';
// import logo from './assets/images/logo.png';
import './App.css';

// const OpenTok = require('opentok');
const OT = require('@opentok/client');

let otCore;

const getQueryString = (field, url) => {
    const href = url || window.location.href;
    const reg = new RegExp(`[?&]${field}=([^&#]*)`, 'i');
    const string = reg.exec(href);
    return string ? string[1] : null;
};

function populateDeviceSources() {
    OT.getDevices((err, devices) => {
        if (err) {
            console.log(`getDevices error ${err.message}`);
            return;
        }

        // ///////////////////// Working for multi Camera
        //
        // const index = 0;
        // selector.innerHTML = devices.reduce((innerHTML, device) => {
        //     if (device.kind === kind) {
        //         index += 1;
        //         return `${innerHTML}<option value="${
        //             device.deviceId
        //         }">${device.label || device.kind + index}</option>`;
        //     }
        return devices;
    }, '');
}

// OT.getUserMedia().then(() => {
//     populateDeviceSources(audioSelector, 'audioInput');
//     populateDeviceSources(videoSelector, 'videoInput');
// });

const otCoreOptions = {
    credentials: {
        apiKey: 'apiKey',
        sessionId: 'sessionId',
        token: 'token'
    },

    // A container can either be a query selector or an HTML Element
    streamContainers(pubSub, type, data, stream) {
        return {
            publisher: {
                camera: '#cameraPublisherContainer',
                screen: '#screenPublisherContainer'
            },
            subscriber: {
                camera: '#cameraSubscriberContainer',
                screen: '#screenSubscriberContainer'
            }
        }[pubSub][type];
    },
    controlsContainer: '#controls',
    packages: ['textChat', 'screenSharing', 'annotation'],
    communication: {
        callProperties: null // Using default
    },
    textChat: {
        name: 'default', // eslint-disable-line no-bitwise
        waitingMessage: 'Messages will be delivered when other users arrive',
        container: '#chat'
    },
    screenSharing: {
        extensionID: 'plocfffmbcclpdifaikiikgplfnepkpo',
        annotation: true,
        externalWindow: false,
        dev: true,
        screenProperties: {
            insertMode: 'append',
            width: '100%',
            height: '100%',
            showControls: false,
            style: {
                buttonDisplayMode: 'off'
            },
            videoSource: 'window',
            fitMode: 'contain' // Using default
        }
    },
    annotation: {
        absoluteParent: {
            publisher: '.App-video-container',
            subscriber: '.App-video-container'
        }
    }
};

/**
 * Build classes for container elements based on state
 * @param {Object} state
 */
const containerClasses = state => {
    const {
        active,
        meta,
        localAudioEnabled,
        localVideoEnabled,
        localCam
    } = state;
    const sharingScreen = meta ? !!meta.publisher.screen : false;
    const viewingSharedScreen = meta ? meta.subscriber.screen : false;
    const activeCameraSubscribers = meta ? meta.subscriber.camera : 0;
    const activeCameraSubscribersGt2 = activeCameraSubscribers > 2;
    const activeCameraSubscribersOdd = activeCameraSubscribers % 2;
    const screenshareActive = viewingSharedScreen || sharingScreen;

    return {
        controlClass: classNames('App-control-container', { hidden: !active }),
        localAudioClass: classNames('ots-video-control circle audio', {
            hidden: !active,
            muted: !localAudioEnabled
        }),
        localVideoClass: classNames('ots-video-control circle video', {
            hidden: !active,
            muted: !localVideoEnabled
        }),
        localCameraClass: classNames('ots-video-control circle camera', {
            hidden: !active,
            front: !localCam
        }),
        localCallClass: classNames('ots-video-control circle end-call', {
            hidden: !active
        }),
        cameraPublisherClass: classNames('video-container', {
            hidden: !active,
            small: !!activeCameraSubscribers || screenshareActive,
            left: screenshareActive
        }),
        screenPublisherClass: classNames('video-container', {
            hidden: !active || !sharingScreen
        }),
        cameraSubscriberClass: classNames(
            'video-container',
            { hidden: !active || !activeCameraSubscribers },
            { 'active-gt2': activeCameraSubscribersGt2 && !screenshareActive },
            { 'active-odd': activeCameraSubscribersOdd && !screenshareActive },
            { small: screenshareActive }
        ),
        screenSubscriberClass: classNames('video-container', {
            hidden: !viewingSharedScreen || !active
        })
    };
};

const connectingMask = () => (
    <div className="App-mask">
        <Spinner />
        <div className="message with-spinner">Connecting</div>
    </div>
);

const loadingMask = () => (
    <div className="App-mask">
        <Spinner />
        <div className="message with-spinner">Connecting</div>
    </div>
);

const startCallMask = start => (
    <div className="App-mask">
        <button className="message button clickable" onClick={start}>
            Click to Start Call{' '}
        </button>
    </div>
);

class App extends Component {
    constructor(props) {
        super(props);
        this.state = {
            connected: false,
            active: false,
            publishers: null,
            started: true,
            subscribers: null,
            meta: null,
            localAudioEnabled: true,
            localVideoEnabled: true,
            localCam: true
        };
        this.startCall = this.startCall.bind(this);
        this.endCall = this.endCall.bind(this);
        this.toggleLocalAudio = this.toggleLocalAudio.bind(this);
        this.toggleLocalVideo = this.toggleLocalVideo.bind(this);
        this.switchLocalCamera = this.switchLocalCamera.bind(this);
    }

    componentDidMount() {
        if (otCoreOptions.credentials.token === null) {
            // console.log('Token is not Present');
        }

        otCoreOptions.credentials.apiKey = getQueryString('apiKey'); // returns 'apiKey'
        otCoreOptions.credentials.sessionId = getQueryString('sessionId'); // returns 'sessionId'
        otCoreOptions.credentials.token = getQueryString('token'); // returns token
        otCoreOptions.textChat.name = getQueryString('name'); // returns name
        otCore = new AccCore(otCoreOptions);

        otCore.connect().then(() => this.setState({ connected: true }));
        const events = [
            'subscribeToCamera',
            'unsubscribeFromCamera',
            'subscribeToScreen',
            'unsubscribeFromScreen',
            'startScreenShare',
            'endScreenShare'
        ];

        events.forEach(event =>
            otCore.on(event, ({ publishers, subscribers, meta }) => {
                this.setState({ publishers, subscribers, meta });
            })
        );
    }

    startCall() {
        this.setState({ started: false });
        otCore
            .startCall()
            .then(({ publishers, subscribers, meta, started }) => {
                this.setState({
                    publishers,
                    subscribers,
                    meta,
                    started: false,
                    active: true
                });
            })
            .catch(error => console.log(error));
    }

    endCall() {
        otCore.endCall();
        this.setState({ active: false, started: true });
    }

    toggleLocalAudio() {
        otCore.toggleLocalAudio(!this.state.localAudioEnabled);
        this.setState({ localAudioEnabled: !this.state.localAudioEnabled });
    }

    toggleLocalVideo() {
        otCore.toggleLocalVideo(!this.state.localVideoEnabled);
        this.setState({ localVideoEnabled: !this.state.localVideoEnabled });
    }

    switchLocalCamera() {
        populateDeviceSources();
        // otCore.switchLocalCamera(!this.state.localCam);
        this.setState({ localCam: !this.state.localCam });
    }

    render() {
        const { connected, active, started } = this.state;
        const {
            localAudioClass,
            localVideoClass,
            localCallClass,
            //   localCameraClass, // IN DEVELOPMENT for multi camerA
            controlClass,
            cameraPublisherClass,
            screenPublisherClass,
            cameraSubscriberClass,
            screenSubscriberClass
        } = containerClasses(this.state);

        return (
            <div className="App">
                {/* Removed Header Due to webview
                    <div className="App-header">
                    <img src={logo} className="App-logo" alt="logo" />
                    <h1>Seers Tech Telemedicine</h1>
                </div> */}
                <div className="App-main">
                    <div className="App-video-container">
                        {!connected && connectingMask()}
                        {connected && !started && !active && loadingMask()}
                        {connected && !active && started && startCallMask(this.startCall)}
                        
                        <div
                            id="cameraPublisherContainer"
                            className={cameraPublisherClass}
                        />
                        <div
                            id="screenPublisherContainer"
                            className={screenPublisherClass}
                        />
                        <div
                            id="cameraSubscriberContainer"
                            className={cameraSubscriberClass}
                        />
                        <div
                            id="screenSubscriberContainer"
                            className={screenSubscriberClass}
                        />
                        <div
                            id="chat"
                            // className="App-chat-container"
                            className="ots-text-chat"
                        />
                        <div id="controls" className={controlClass}>
                            {/* Was Working on Camera Switching
                            <div className={localCameraClass}
                            onClick={this.switchLocalCamera}
                        /> */}
                            <div
                                className={localAudioClass}
                                onClick={this.toggleLocalAudio}
                            />
                            <div
                                className={localVideoClass}
                                onClick={this.toggleLocalVideo}
                            />
                            <div
                                className={localCallClass}
                                onClick={this.endCall}
                            />
                            {/* Was Working on Camera Switching
                            <label htmlFor="video-source-select">
                            Video Source:
                        </label>
                        <select id="video-source-select" /> */}
                            {/* <button id="cycle-video-btn" type="button">
                            Cycle Video
                        </button> */}
                            {/* <br /> */}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default App;
