import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';

// --- SHARED UI COMPONENTS ---

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

const Button: React.FC<ButtonProps> = ({ children, className, variant = 'primary', ...props }) => {
  const baseClasses = 'font-bold py-2 px-4 rounded-md transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#2B2D42] disabled:opacity-50 disabled:cursor-not-allowed';
  const variantClasses = variant === 'primary'
    ? 'bg-[#FFD700] text-[#1E1E2F] hover:bg-[#E6C200] focus:ring-[#FFD700]'
    : 'bg-[#3A3D5B] text-[#EAEAEA] hover:bg-[#E6C200] hover:text-[#1E1E2F] focus:ring-[#3A3D5B]';
  return <button className={`${baseClasses} ${variantClasses} ${className}`} {...props}>{children}</button>;
};


interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input: React.FC<InputProps> = ({ className, ...props }) => (
  <input className={`bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors ${className}`} {...props} />
);

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select: React.FC<SelectProps> = ({ children, className, ...props }) => (
    <select className={`bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors appearance-none bg-no-repeat bg-right pr-8 ${className}`} {...props}>
        {children}
    </select>
);


const ToolContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="space-y-4">{children}</div>
);

const FileInput: React.FC<{ id: string, label: string, accept: string, onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }> = ({ id, label, accept, onChange }) => (
    <div>
        <label htmlFor={id} className="block mb-2 font-medium">{label}</label>
        <Input type="file" id={id} accept={accept} onChange={onChange} className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:font-semibold file:bg-[#FFD700] file:text-[#1E1E2F] hover:file:bg-[#E6C200]"/>
    </div>
);

// --- HELPER FUNCTIONS ---
const fileToDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const downloadUrl = (url: string, filename: string) => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Helper function to create a WAV file from an AudioBuffer
const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    let numOfChan = buffer.numberOfChannels,
    len = buffer.length * numOfChan * 2 + 44,
    wavBuffer = new ArrayBuffer(len),
    view = new DataView(wavBuffer),
    channels = [], i, sample,
    offset = 0,
    pos = 0;

    // write WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(len - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(len - pos - 4); // chunk length

    function setUint16(data: number) {
        view.setUint16(pos, data, true);
        pos += 2;
    }

    function setUint32(data: number) {
        view.setUint32(pos, data, true);
        pos += 4;
    }

    for (i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while (pos < len) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++
    }
    return wavBuffer;
};

// --- REUSABLE API KEY HANDLING ---

const useApiKeyCheck = () => {
    const [apiKeySelected, setApiKeySelected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkApiKey = useCallback(async () => {
        try {
            if ((window as any).aistudio && typeof (window as any).aistudio.hasSelectedApiKey === 'function') {
                const hasKey = await (window as any).aistudio.hasSelectedApiKey();
                setApiKeySelected(hasKey);
                return hasKey;
            }
             setError("AI Studio context not available.");
        } catch (e) {
            console.error("Error checking for API key:", e);
            setError("Could not verify API key status.");
        }
        return false;
    }, []);

    useEffect(() => {
        checkApiKey();
    }, [checkApiKey]);

    const handleSelectKey = async () => {
        try {
            if ((window as any).aistudio && typeof (window as any).aistudio.openSelectKey === 'function') {
                await (window as any).aistudio.openSelectKey();
                await checkApiKey(); // Re-check after user interaction
            }
        } catch (e) {
             console.error("Error opening key selection:", e);
             setError("Could not open the API key selection dialog.");
        }
    };
    
    const resetApiKey = () => {
        setApiKeySelected(false);
    };

    return { apiKeySelected, handleSelectKey, error, resetApiKey, setError };
};


const ApiKeyPrompt: React.FC<{ onSelectKey: () => void; error?: string | null }> = ({ onSelectKey, error }) => (
    <ToolContainer>
        <div className="text-center p-4 bg-[#1E1E2F] rounded-md">
            <h3 className="text-xl font-bold text-[#FFD700] mb-2">API Key Required</h3>
            <p className="mb-4">This tool uses a powerful model that requires a Google AI Studio API key. Please select a key to continue.</p>
            <p className="text-sm text-gray-400 mb-4">For more information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <Button onClick={onSelectKey}>Select API Key</Button>
            {error && <p className="text-red-400 mt-4">{error}</p>}
        </div>
    </ToolContainer>
);


// --- TOOL COMPONENTS ---

export const ImageConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
    const [output, setOutput] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setOutput(null);
    };

    const handleConvert = async () => {
        if (!file || !canvasRef.current) return;
        setStatus('Processing...');
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current!;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const convertedUrl = canvas.toDataURL(`image/${format}`);
            setOutput(convertedUrl);
            setStatus('Conversion complete!');
        };
        img.src = dataUrl;
    };
    
    return (
        <ToolContainer>
            <FileInput id="img-convert-file" label="Upload Image" accept="image/*" onChange={handleFileChange} />
            <div className="flex items-center gap-4">
              <label htmlFor="format-select">Convert to:</label>
              <Select id="format-select" value={format} onChange={(e) => setFormat(e.target.value as any)}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPG</option>
                  <option value="webp">WEBP</option>
              </Select>
              <Button onClick={handleConvert} disabled={!file}>Convert</Button>
            </div>
            {status && <p>{status}</p>}
            <canvas ref={canvasRef} className="hidden"></canvas>
            {output && (
                <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <img src={output} alt="Converted" className="max-w-full h-auto rounded-md shadow-lg" />
                    <Button onClick={() => downloadUrl(output, `converted.${format}`)} className="mt-4">Download</Button>
                </div>
            )}
        </ToolContainer>
    );
};

export const ImageCompressor: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [quality, setQuality] = useState(0.7);
    const [output, setOutput] = useState<string | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [status, setStatus] = useState('');
    const [originalSize, setOriginalSize] = useState(0);
    const [compressedSize, setCompressedSize] = useState(0);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files ? e.target.files[0] : null;
        setFile(f);
        if (f) setOriginalSize(f.size);
        setOutput(null);
    };

    const handleCompress = async () => {
        if (!file || !canvasRef.current) return;
        setStatus('Compressing...');
        const dataUrl = await fileToDataUrl(file);
        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current!;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            const compressedUrl = canvas.toDataURL('image/jpeg', quality);
            setOutput(compressedUrl);
            fetch(compressedUrl).then(res => res.blob()).then(blob => setCompressedSize(blob.size));
            setStatus('Compression complete!');
        };
        img.src = dataUrl;
    };

    return (
        <ToolContainer>
            <FileInput id="img-compress-file" label="Upload Image" accept="image/jpeg,image/png" onChange={handleFileChange} />
            <div>
              <label htmlFor="quality-range">Quality: {Math.round(quality * 100)}%</label>
              <input id="quality-range" type="range" min="0.1" max="1" step="0.05" value={quality} onChange={e => setQuality(parseFloat(e.target.value))} className="w-full" />
            </div>
            <Button onClick={handleCompress} disabled={!file}>Compress</Button>
            {status && <p>{status}</p>}
            {originalSize > 0 && <p>Original size: {(originalSize / 1024).toFixed(2)} KB</p>}
            {compressedSize > 0 && <p className="text-[#FFD700]">Compressed size: {(compressedSize / 1024).toFixed(2)} KB ({(100 - (compressedSize / originalSize * 100)).toFixed(1)}% reduction)</p>}
            <canvas ref={canvasRef} className="hidden"></canvas>
            {output && (
                <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <img src={output} alt="Compressed" className="max-w-full h-auto rounded-md shadow-lg" />
                    <Button onClick={() => downloadUrl(output, `compressed.jpg`)} className="mt-4">Download</Button>
                </div>
            )}
        </ToolContainer>
    );
};

export const ImageCropper: React.FC = () => {
    // This is a simplified implementation. A library would be better for production.
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 10, y: 10, width: 100, height: 100 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const imageRef = useRef<HTMLImageElement>(null);
    const [croppedImage, setCroppedImage] = useState<string | null>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const dataUrl = await fileToDataUrl(e.target.files[0]);
            setImageSrc(dataUrl);
            setCroppedImage(null);
        }
    };
    
    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!imageRef.current) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setIsDragging(true);
        setDragStart({ x: x - crop.x, y: y - crop.y });
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging && imageRef.current) {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            setCrop(c => ({
                ...c,
                x: Math.max(0, Math.min(x - dragStart.x, imageRef.current!.width - c.width)),
                y: Math.max(0, Math.min(y - dragStart.y, imageRef.current!.height - c.height)),
            }));
        }
    };

    const onPointerUp = () => setIsDragging(false);

    const handleCrop = () => {
        if (!imageSrc || !imageRef.current) return;
        const canvas = document.createElement('canvas');
        const img = imageRef.current;
        const scaleX = img.naturalWidth / img.width;
        const scaleY = img.naturalHeight / img.height;
        
        canvas.width = crop.width * scaleX;
        canvas.height = crop.height * scaleY;
        const ctx = canvas.getContext('2d');

        ctx?.drawImage(
            img,
            crop.x * scaleX,
            crop.y * scaleY,
            crop.width * scaleX,
            crop.height * scaleY,
            0,
            0,
            canvas.width,
            canvas.height
        );
        setCroppedImage(canvas.toDataURL('image/png'));
    };

    return (
        <ToolContainer>
            <FileInput id="img-crop-file" label="Upload Image" accept="image/*" onChange={handleFileChange} />
            {imageSrc && (
                <div className="space-y-4">
                    <div 
                        className="relative select-none"
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerUp}
                        onPointerLeave={onPointerUp}
                    >
                        <img ref={imageRef} src={imageSrc} alt="To be cropped" className="max-w-full h-auto" />
                        <div
                            className="absolute border-2 border-dashed border-[#FFD700] cursor-move bg-black bg-opacity-30"
                            style={{ left: crop.x, top: crop.y, width: crop.width, height: crop.height }}
                            onPointerDown={onPointerDown}
                        ></div>
                    </div>
                    <Button onClick={handleCrop}>Crop Image</Button>
                </div>
            )}
            {croppedImage && (
                 <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <img src={croppedImage} alt="Cropped" className="max-w-full h-auto rounded-md shadow-lg" />
                    <Button onClick={() => downloadUrl(croppedImage, `cropped.png`)} className="mt-4">Download</Button>
                </div>
            )}
        </ToolContainer>
    );
};

export const VideoConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [output, setOutput] = useState<string | null>(null);
    const [status, setStatus] = useState('');
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setOutput(null);
        setStatus('');
    };

    const handleConvert = async () => {
        if (!file || !videoRef.current || !canvasRef.current) return;

        setStatus('Setting up converter...');
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;

        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const chunks: Blob[] = [];
            let recorder: MediaRecorder;
            let combinedStream: MediaStream;

            try {
                // 1. Get Video Track from Canvas
                const canvasStream = canvas.captureStream(30); // 30 fps
                const [videoTrack] = canvasStream.getVideoTracks();

                // 2. Get Audio Track from Video Element
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const source = audioCtx.createMediaElementSource(video);
                const dest = audioCtx.createMediaStreamDestination();
                source.connect(dest);
                const [audioTrack] = dest.stream.getAudioTracks();

                // 3. Combine tracks if audio exists
                // FIX: Cast to any to access non-standard properties for audio detection and add parentheses to correct logical grouping.
                if (audioTrack && ((video as any).mozHasAudio || (video as any).webkitAudioDecodedByteCount > 0 || video.played.length > 0)) {
                    combinedStream = new MediaStream([videoTrack, audioTrack]);
                } else {
                    // Fallback for videos with no audio
                    combinedStream = canvasStream;
                }

                // 4. Set up MediaRecorder
                const mimeType = 'video/webm; codecs=vp9,opus';
                if (!MediaRecorder.isTypeSupported(mimeType)) {
                     setStatus('Error: WebM VP9/Opus format not supported by your browser.');
                     return;
                }
                recorder = new MediaRecorder(combinedStream, { mimeType });

                recorder.ondataavailable = (e) => {
                    if (e.data.size > 0) {
                        chunks.push(e.data);
                    }
                };

                recorder.onstop = () => {
                    const blob = new Blob(chunks, { type: 'video/webm' });
                    const url = URL.createObjectURL(blob);
                    setOutput(url);
                    setStatus('Conversion complete!');
                    URL.revokeObjectURL(videoUrl);
                };
                
                const ctx = canvas.getContext('2d');
                
                const drawFrame = () => {
                    if (!video.paused && !video.ended) {
                        ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
                        requestAnimationFrame(drawFrame);
                    }
                };

                video.onplay = () => {
                    recorder.start();
                    requestAnimationFrame(drawFrame);
                    setStatus('Processing... This may take a while.');
                };

                video.onended = () => {
                    if(recorder.state === 'recording') {
                        recorder.stop();
                    }
                };
                
                // Mute the video to prevent playback sound during conversion
                video.muted = true; 
                video.play().catch(e => {
                    setStatus(`Error playing video: ${e.message}`);
                    console.error(e);
                });

            } catch (error: any) {
                setStatus(`An error occurred: ${error.message}`);
                console.error(error);
            }
        };

        video.onerror = () => {
            setStatus('Error: Could not load video file. It might be corrupted or in an unsupported format.');
        };
    };

    return (
        <ToolContainer>
            <FileInput id="video-convert-file" label="Upload Video" accept="video/*" onChange={handleFileChange} />
            <p className="text-sm text-gray-400">Note: This tool re-encodes video in the browser to WebM format. The process can be slow and may not work for all video files. Audio is preserved.</p>
            <Button onClick={handleConvert} disabled={!file}>Convert to WebM</Button>
            {status && <p>{status}</p>}
            <video ref={videoRef} className="hidden" crossOrigin="anonymous"></video>
            <canvas ref={canvasRef} className="hidden"></canvas>
            {output && (
                <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <video controls src={output} className="w-full rounded-md shadow-lg"></video>
                    <a href={output} download="converted.webm">
                       <Button className="mt-4">Download WebM</Button>
                    </a>
                </div>
            )}
        </ToolContainer>
    );
};

export const TextToVideoMaker: React.FC = () => {
    const [prompt, setPrompt] = useState('A cinematic shot of a panda riding a skateboard in a futuristic city at night.');
    const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
    const [status, setStatus] = useState('');
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const { apiKeySelected, handleSelectKey, error, resetApiKey, setError } = useApiKeyCheck();

    const handleGenerate = async () => {
        setError(null);
        setVideoUrl(null);
        if (!prompt) {
            setError("Please enter a prompt.");
            return;
        }

        try {
            setStatus('Initializing model...');
            // Create a new instance right before the call
            const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
            
            setStatus('Starting video generation...');
            let operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: aspectRatio
                }
            });

            setStatus('Processing... This may take a few minutes.');
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                setStatus('Polling for results...');
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }
            
            setStatus('Fetching video data...');
            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

            if (downloadLink) {
                 const response = await fetch(`${downloadLink}&key=${(process as any).env.API_KEY}`);
                 if (!response.ok) {
                    throw new Error(`Failed to fetch video: ${response.statusText}`);
                 }
                 const blob = await response.blob();
                 const url = URL.createObjectURL(blob);
                 setVideoUrl(url);
                 setStatus('Video generated successfully!');
            } else {
                throw new Error("Generation finished, but no video link was found.");
            }

        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("Requested entity was not found")) {
                 setError("Your API key is invalid or has been revoked. Please select a valid key.");
                 resetApiKey(); // Force re-selection
            } else {
                setError(`An error occurred: ${e.message}`);
            }
            setStatus('');
        }
    };
    
    if (!apiKeySelected) {
        return <ApiKeyPrompt onSelectKey={handleSelectKey} error={error} />;
    }

    return (
        <ToolContainer>
            <p className="text-sm text-gray-400">Describe the video you want to create. Be descriptive about the subject, style, colors, and actions.</p>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors" placeholder="e.g., A robot holding a red skateboard."></textarea>
            <div>
              <label htmlFor="aspect-ratio-select">Aspect Ratio:</label>
              <Select id="aspect-ratio-select" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as any)}>
                  <option value="16:9">16:9 (Landscape)</option>
                  <option value="9:16">9:16 (Portrait)</option>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={!!status && status !== 'Video generated successfully!'}>
                {status ? status : 'Generate Video'}
            </Button>
            {error && <p className="text-red-400">{error}</p>}
            {videoUrl && (
                <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <video controls src={videoUrl} className="w-full rounded-md shadow-lg"></video>
                    <a href={videoUrl} download="generated-video.mp4">
                       <Button className="mt-4">Download Video</Button>
                    </a>
                </div>
            )}
        </ToolContainer>
    );
};

export const ColoringBookMaker: React.FC = () => {
    const [subject, setSubject] = useState('A curious space cat');
    const [progress, setProgress] = useState(0);
    const [statusText, setStatusText] = useState('');
    const [generatedImages, setGeneratedImages] = useState<{ base64: string, modifier: string }[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const { apiKeySelected, handleSelectKey, error, resetApiKey, setError } = useApiKeyCheck();

    const MAX_PAGES = 20;

    const PROMPT_MODIFIERS = [
        "Minimalist, bold lines, cartoon style, simple background.",
        "Detailed, intricate pattern background, zentangle elements, surrounded by flowers.",
        "Geometric shapes and angles, cubist influence, sharp edges.",
        "A cute, 'chibi' style, oversized head, playing with a toy.",
        "A majestic, epic style, cinematic view, standing on a mountain.",
        "Pop art influence, heavy black outlines, against a striped pattern.",
        "Manga/comic book panel style, in a dynamic action pose.",
        "Steampunk elements, cogs, and gears, wearing goggles.",
        "An underwater scene, fluid lines, surrounded by seaweed and bubbles.",
        "A space scene, stars, and planets visible, floating weightlessly.",
        "Medieval tapestry style, ornate, thick borders, in a castle.",
        "Simple, friendly, for a toddler, holding a large object.",
        "Futuristic, sci-fi city background, sleek and angular.",
        "Wild west setting, desert elements, wearing a cowboy hat.",
        "Art deco geometric pattern background, symmetrical and elegant.",
        "Whimsical, classic storybook illustration style, reading a book.",
        "Mythological scene, ancient ruins, surrounded by vines.",
        "Abstract, flowing ink shapes surrounding the subject, wavy lines.",
        "A mosaic pattern style, composed of small, tiled segments.",
        "Dot art or stipple technique outline, standing in a field.",
    ];

    const PROMPT_TEMPLATE = (name: string, modifier: string) => 
        `A high-contrast, black and white coloring page sketch of **${name}**. Style: ${modifier} The lines must be thick and solid. Absolutely no color, shading, or grey tones are allowed. The background must be pure white.`;

    const handleGenerate = async () => {
        if (!subject) {
            setError("Please describe a character or subject.");
            return;
        }

        setIsGenerating(true);
        setError(null);
        setGeneratedImages([]);
        
        try {
            const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
            
            for (let i = 0; i < MAX_PAGES; i++) {
                const modifier = PROMPT_MODIFIERS[i % PROMPT_MODIFIERS.length];
                const status = `Generating page ${i + 1} of ${MAX_PAGES} (${modifier.split(',')[0]} style)...`;
                setStatusText(status);
                setProgress(((i) / MAX_PAGES) * 100);

                const prompt = PROMPT_TEMPLATE(subject, modifier);
                
                const response = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: prompt,
                    config: {
                        numberOfImages: 1,
                        outputMimeType: 'image/jpeg',
                        aspectRatio: '1:1',
                    },
                });

                const base64Image = response.generatedImages[0].image.imageBytes;
                if (base64Image) {
                    setGeneratedImages(prev => [...prev, { base64: base64Image, modifier: modifier }]);
                } else {
                    throw new Error(`Failed to generate page ${i + 1}.`);
                }
            }
            setStatusText(`All ${MAX_PAGES} sketches generated! Your PDF is ready to download.`);
            setProgress(100);

        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("Requested entity was not found")) {
                 setError("Your API key is invalid or has been revoked. Please select a valid key.");
                 resetApiKey();
            } else {
                setError(`An error occurred: ${e.message}`);
            }
            setStatusText('Generation failed. Please try again.');
            setProgress(0);
        } finally {
            setIsGenerating(false);
        }
    };

    const createAndDownloadPDF = () => {
        if (generatedImages.length < MAX_PAGES) {
            setError("Please wait for all images to be generated first!");
            return;
        }
        if (!(window as any).jspdf) {
            setError("PDF generation library is not loaded. Please try again in a moment.");
            return;
        }
        
        setStatusText("Creating PDF...");

        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const margin = 10;
        const contentW = pageW - 2 * margin;
        const contentH = pageH - 2 * margin;

        // Title Page
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(36);
        doc.setTextColor('#1E1E2F');
        doc.text("My Custom Coloring Book", pageW / 2, pageH / 4, { align: 'center' });

        doc.setFontSize(24);
        doc.setTextColor('#3A3D5B');
        doc.text(`Featuring:`, pageW / 2, pageH / 4 + 25, { align: 'center' });
        
        doc.setFontSize(32);
        doc.setTextColor('#1E1E2F');
        const textLines = doc.splitTextToSize(subject, pageW * 0.8);
        doc.text(textLines, pageW / 2, pageH / 4 + 50, { align: 'center' });
        
        doc.setFontSize(16);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor('#3A3D5B');
        doc.text(`A ${generatedImages.length}-Page Collection of Diverse Styles`, pageW / 2, pageH - 50, { align: 'center' });
        
        // Coloring Pages
        generatedImages.forEach((imgData, index) => {
            doc.addPage();
            
            const imgDim = Math.min(contentW, contentH);
            const imgX = (pageW - imgDim) / 2;
            const imgY = (pageH - imgDim) / 2;

            doc.addImage(`data:image/jpeg;base64,${imgData.base64}`, 'JPEG', imgX, imgY, imgDim, imgDim, undefined, 'SLOW');
            
            doc.setFontSize(10);
            doc.setTextColor('#3A3D5B');
            doc.text(`Page ${index + 1} of ${MAX_PAGES}`, pageW - margin, pageH - margin, { align: 'right' });
            doc.text(`Style: ${imgData.modifier.split(',')[0]}`, margin, pageH - margin, { align: 'left' });
        });

        const safeName = subject.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        doc.save(`${safeName}_${MAX_PAGES}_page_coloring_book.pdf`);
        setStatusText("PDF downloaded!");
    };

    if (!apiKeySelected) {
       return <ApiKeyPrompt onSelectKey={handleSelectKey} error={error} />;
    }

    return (
        <ToolContainer>
            <p className="text-sm text-gray-400">Describe a character or theme. The AI will generate a {MAX_PAGES}-page coloring book with varied artistic styles and compile them into a downloadable PDF.</p>
            <div className="flex flex-col md:flex-row gap-4">
                <Input 
                    type="text" 
                    value={subject} 
                    onChange={e => setSubject(e.target.value)}
                    placeholder="e.g., a brave knight, a whimsical forest, cute kittens"
                    className="flex-grow"
                    disabled={isGenerating}
                />
                <Button onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : `Generate ${MAX_PAGES}-Page Book`}
                </Button>
            </div>

            {isGenerating || statusText ? (
                <div className="space-y-2 mt-4">
                    <p className="text-center font-semibold text-[#FFD700]">{statusText}</p>
                    <div className="w-full bg-[#1E1E2F] rounded-full h-4 border border-[#3A3D5B]">
                        <div 
                            className="bg-[#FFD700] h-full rounded-full transition-all duration-500" 
                            style={{ width: `${progress}%` }}
                        ></div>
                    </div>
                </div>
            ) : null}
            
            {error && <p className="text-red-400 mt-2 text-center">{error}</p>}

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mt-4">
                {generatedImages.map((img, index) => (
                    <div key={index} className="bg-[#1E1E2F] p-2 rounded-lg text-center border border-[#3A3D5B]">
                        <img 
                            src={`data:image/jpeg;base64,${img.base64}`} 
                            alt={`Coloring page ${index + 1}`} 
                            className="w-full h-auto rounded-md aspect-square object-contain"
                        />
                        <p className="text-xs text-gray-400 mt-1 truncate" title={img.modifier}>
                           {`P${index + 1}: ${img.modifier.split(',')[0]}`}
                        </p>
                    </div>
                ))}
            </div>

            {generatedImages.length === MAX_PAGES && !isGenerating && (
                <div className="text-center mt-6">
                    <Button onClick={createAndDownloadPDF} className="text-lg px-8 py-4">
                        Download PDF Coloring Book
                    </Button>
                </div>
            )}
        </ToolContainer>
    );
};


export const AudioConverter: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [output, setOutput] = useState<string | null>(null);
    const [status, setStatus] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFile(e.target.files ? e.target.files[0] : null);
        setOutput(null);
    };

    const handleConvert = async () => {
        if (!file) return;
        setStatus('Processing...');
        try {
            const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
            
            const wavBuffer = audioBufferToWav(audioBuffer);
            const blob = new Blob([wavBuffer], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            
            setOutput(url);
            setStatus('Conversion to WAV complete!');
        } catch (error) {
            console.error(error);
            setStatus('Error: Could not process audio file. It might be in an unsupported format.');
        }
    };
    
    return (
        <ToolContainer>
            <FileInput id="audio-convert-file" label="Upload Audio" accept="audio/*" onChange={handleFileChange} />
            <p className="text-sm text-gray-400">Note: Converts audio to WAV format. MP3 encoding is too complex for a simple browser tool.</p>
            <Button onClick={handleConvert} disabled={!file}>Convert to WAV</Button>
            {status && <p>{status}</p>}
            {output && (
                <div>
                    <h3 className="font-bold text-lg mb-2">Result:</h3>
                    <audio controls src={output} className="w-full"></audio>
                    <a href={output} download="converted.wav">
                       <Button className="mt-4">Download WAV</Button>
                    </a>
                </div>
            )}
        </ToolContainer>
    );
};

export const AudioTrimmer: React.FC = () => {
    const [file, setFile] = useState<File | null>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer|null>(null);
    const [startTime, setStartTime] = useState(0);
    const [endTime, setEndTime] = useState(10);
    const [output, setOutput] = useState<string | null>(null);
    const [status, setStatus] = useState('');

    useEffect(() => {
        if (!file) return;
        const loadAudio = async () => {
            setStatus("Loading audio...");
            setAudioBuffer(null);
            setOutput(null);
            try {
                const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
                const arrayBuffer = await file.arrayBuffer();
                const buffer = await audioCtx.decodeAudioData(arrayBuffer);
                setAudioBuffer(buffer);
                setStartTime(0);
                setEndTime(buffer.duration);
                setStatus("Audio loaded.");
            } catch (error) {
                setStatus("Error: Could not decode audio file.");
                console.error(error);
            }
        };
        loadAudio();
    }, [file]);

    const handleTrim = () => {
        if (!audioBuffer) return;
        setStatus("Trimming...");
        
        const start = Math.max(0, startTime);
        const end = Math.min(endTime, audioBuffer.duration);

        if (end <= start) {
            setStatus("Error: End time must be after start time.");
            return;
        }

        const startSample = Math.floor(start * audioBuffer.sampleRate);
        const endSample = Math.floor(end * audioBuffer.sampleRate);
        const length = endSample - startSample;

        const newBuffer = new AudioContext().createBuffer(
            audioBuffer.numberOfChannels,
            length,
            audioBuffer.sampleRate
        );

        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            const newChannelData = newBuffer.getChannelData(i);
            newChannelData.set(channelData.subarray(startSample, endSample));
        }
        
        const wavBuffer = audioBufferToWav(newBuffer);
        const blob = new Blob([wavBuffer], { type: 'audio/wav' });
        setOutput(URL.createObjectURL(blob));
        setStatus("Trimming complete.");
    };

    return (
        <ToolContainer>
            <FileInput id="audio-trim-file" label="Upload Audio" accept="audio/*" onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)} />
            {status && <p>{status}</p>}
            {audioBuffer && (
                <>
                    <div>Duration: {audioBuffer.duration.toFixed(2)}s</div>
                    <div className="flex flex-col md:flex-row gap-4">
                        <label className="flex-1">Start (s): <Input type="number" value={startTime} onChange={e => setStartTime(parseFloat(e.target.value))} max={audioBuffer.duration} min={0} step="0.1" /></label>
                        <label className="flex-1">End (s): <Input type="number" value={endTime} onChange={e => setEndTime(parseFloat(e.target.value))} max={audioBuffer.duration} min={0} step="0.1" /></label>
                    </div>
                    <Button onClick={handleTrim}>Trim</Button>
                </>
            )}
            {output && (
                <div className="mt-4">
                    <h3 className="font-bold text-lg mb-2">Trimmed Audio:</h3>
                    <audio controls src={output} className="w-full"></audio>
                    <a href={output} download="trimmed.wav">
                       <Button className="mt-4">Download Trimmed WAV</Button>
                    </a>
                </div>
            )}
        </ToolContainer>
    );
};

export const AgeCalculator: React.FC = () => {
    const [dob, setDob] = useState('');
    const [age, setAge] = useState<string | null>(null);

    const calculateAge = () => {
        if (!dob) {
            setAge(null);
            return;
        }
        const birthDate = new Date(dob);
        const today = new Date();
        
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();
        let days = today.getDate() - birthDate.getDate();

        if (days < 0) {
            months--;
            days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        }
        if (months < 0) {
            years--;
            months += 12;
        }
        setAge(`${years} years, ${months} months, and ${days} days`);
    };

    return (
        <ToolContainer>
            <label>Enter your Date of Birth:
                <Input type="date" value={dob} onChange={e => setDob(e.target.value)} />
            </label>
            <Button onClick={calculateAge}>Calculate Age</Button>
            {age && <div className="text-xl p-4 bg-[#1E1E2F] rounded-md text-center"><p className="font-bold text-[#FFD700]">You are:</p><p>{age}</p></div>}
        </ToolContainer>
    );
};

export const EmiCalculator: React.FC = () => {
    const [amount, setAmount] = useState(100000);
    const [rate, setRate] = useState(8.5);
    const [tenure, setTenure] = useState(5); // in years
    const [emi, setEmi] = useState('');

    const calculateEmi = () => {
        const p = amount;
        const r = rate / 12 / 100;
        const n = tenure * 12;
        if (p > 0 && r > 0 && n > 0) {
            const emiVal = (p * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            setEmi(`Monthly EMI: ${emiVal.toFixed(2)}, Total Interest: ${(emiVal * n - p).toFixed(2)}, Total Payment: ${(emiVal * n).toFixed(2)}`);
        } else {
            setEmi('');
        }
    };
    
    useEffect(calculateEmi, [amount, rate, tenure]);

    return (
        <ToolContainer>
            <div><label>Loan Amount:</label><Input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div>
            <div><label>Interest Rate (% p.a.):</label><Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} /></div>
            <div><label>Loan Tenure (years):</label><Input type="number" value={tenure} onChange={e => setTenure(Number(e.target.value))} /></div>
            {emi && <div className="text-lg p-4 bg-[#1E1E2F] rounded-md text-center text-[#FFD700]">{emi}</div>}
        </ToolContainer>
    );
};

export const SipCalculator: React.FC = () => {
    const [investment, setInvestment] = useState(5000);
    const [rate, setRate] = useState(12);
    const [duration, setDuration] = useState(10); // in years
    const [result, setResult] = useState('');
    
    const calculateSip = () => {
        const p = investment;
        const i = rate / 12 / 100;
        const n = duration * 12;

        if (p > 0 && i > 0 && n > 0) {
            const futureValue = p * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
            const totalInvested = p * n;
            const wealthGained = futureValue - totalInvested;
            setResult(`Invested: ${totalInvested.toFixed(0)}, Est. Returns: ${wealthGained.toFixed(0)}, Future Value: ${futureValue.toFixed(0)}`);
        } else {
            setResult('');
        }
    };

    useEffect(calculateSip, [investment, rate, duration]);
    
    return (
        <ToolContainer>
            <div><label>Monthly Investment:</label><Input type="number" value={investment} onChange={e => setInvestment(Number(e.target.value))} /></div>
            <div><label>Expected Return Rate (% p.a.):</label><Input type="number" value={rate} onChange={e => setRate(Number(e.target.value))} /></div>
            <div><label>Time Period (years):</label><Input type="number" value={duration} onChange={e => setDuration(Number(e.target.value))} /></div>
            {result && <div className="text-lg p-4 bg-[#1E1E2F] rounded-md text-center text-[#FFD700]">{result}</div>}
        </ToolContainer>
    );
};

export const QrCodeGenerator: React.FC = () => {
    const [text, setText] = useState('https://react.dev');
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const generateQrCode = () => {
            // Defensively check that the QRCode library has loaded onto the window object.
            if (canvasRef.current && text && typeof (window as any).QRCode?.toCanvas === 'function') {
                (window as any).QRCode.toCanvas(canvasRef.current, text, { width: 256 }, (error: Error | null) => {
                    if (error) console.error("QR Code Error: ", error);
                });
                return true; // Indicate success
            }
            return false; // Indicate library not ready
        };
        
        // Attempt to generate the QR code immediately. If it fails (because the library
        // hasn't loaded yet), set a brief timeout to try again. This handles the
        // race condition between the component rendering and the external script loading.
        if (!generateQrCode()) {
            const timeoutId = setTimeout(generateQrCode, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [text]);

    const handleDownload = () => {
        if (canvasRef.current) {
            const url = canvasRef.current.toDataURL('image/png');
            downloadUrl(url, 'qrcode.png');
        }
    };

    return (
        <ToolContainer>
            <label>Enter Text or URL:</label>
            <Input type="text" value={text} onChange={e => setText(e.target.value)} />
            <div className="flex justify-center p-4 bg-white rounded-md">
                <canvas ref={canvasRef}></canvas>
            </div>
            <Button onClick={handleDownload} disabled={!text}>Download QR Code</Button>
        </ToolContainer>
    );
};

export const PasswordGenerator: React.FC = () => {
    const [length, setLength] = useState(16);
    const [includeNumbers, setIncludeNumbers] = useState(true);
    const [includeSymbols, setIncludeSymbols] = useState(true);
    const [password, setPassword] = useState('');

    const generatePassword = useCallback(() => {
        const lower = 'abcdefghijklmnopqrstuvwxyz';
        const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const symbols = '!@#$%^&*()_+~`|}{[]:;?><,./-=';
        
        let charset = lower + upper;
        if (includeNumbers) charset += numbers;
        if (includeSymbols) charset += symbols;
        
        let newPassword = '';
        for (let i = 0; i < length; i++) {
            newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        setPassword(newPassword);
    }, [length, includeNumbers, includeSymbols]);

    useEffect(() => {
        generatePassword();
    }, [generatePassword]);

    return (
        <ToolContainer>
            <div className="flex items-center justify-between p-3 bg-[#1E1E2F] rounded-md font-mono text-lg">
                <span className="text-[#FFD700] break-all">{password}</span>
                <Button variant="secondary" onClick={() => navigator.clipboard.writeText(password)}>Copy</Button>
            </div>
            <div>
                <label>Length: {length}</label>
                <input type="range" min="8" max="64" value={length} onChange={e => setLength(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex gap-4">
                <label><input type="checkbox" checked={includeNumbers} onChange={e => setIncludeNumbers(e.target.checked)} /> Numbers</label>
                <label><input type="checkbox" checked={includeSymbols} onChange={e => setIncludeSymbols(e.target.checked)} /> Symbols</label>
            </div>
            <Button onClick={generatePassword}>Generate New</Button>
        </ToolContainer>
    );
};

export const WordCounter: React.FC = () => {
    const [text, setText] = useState('');
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    const chars = text.length;
    const spaces = text.split(' ').length - 1;
    const readingTime = Math.ceil(words / 200);

    return (
        <ToolContainer>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={8} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors" placeholder="Start typing here..."></textarea>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 bg-[#1E1E2F] rounded-md"><div className="font-bold text-[#FFD700] text-2xl">{words}</div>Words</div>
                <div className="p-3 bg-[#1E1E2F] rounded-md"><div className="font-bold text-[#FFD700] text-2xl">{chars}</div>Characters</div>
                <div className="p-3 bg-[#1E1E2F] rounded-md"><div className="font-bold text-[#FFD700] text-2xl">{spaces}</div>Spaces</div>
                <div className="p-3 bg-[#1E1E2F] rounded-md"><div className="font-bold text-[#FFD700] text-2xl">{readingTime}</div>Min Read</div>
            </div>
        </ToolContainer>
    );
};

export const Base64EncoderDecoder: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [mode, setMode] = useState<'encode' | 'decode'>('encode');

    const handleProcess = () => {
        try {
            if (mode === 'encode') {
                setOutput(btoa(input));
            } else {
                setOutput(atob(input));
            }
        } catch (error) {
            setOutput('Invalid input for selected mode.');
        }
    };
    
    return (
        <ToolContainer>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={5} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors" placeholder="Input..."></textarea>
            <div className="flex gap-4">
                <Button onClick={() => setMode('encode')} className={mode === 'encode' ? '' : 'opacity-50'}>Encode</Button>
                <Button onClick={() => setMode('decode')} className={mode === 'decode' ? '' : 'opacity-50'}>Decode</Button>
                <Button onClick={handleProcess}>Process</Button>
            </div>
            <textarea value={output} readOnly rows={5} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full" placeholder="Output..."></textarea>
        </ToolContainer>
    );
};

export const ColorPicker: React.FC = () => {
    const [color, setColor] = useState('#ffd700');

    const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})` : null;
    };
    
    const hexToHsl = (hex: string) => {
        let r = 0, g = 0, b = 0;
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            r = parseInt(result[1], 16) / 255;
            g = parseInt(result[2], 16) / 255;
            b = parseInt(result[3], 16) / 255;
        }
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }
        return `hsl(${(h * 360).toFixed(0)}, ${(s * 100).toFixed(0)}%, ${(l * 100).toFixed(0)}%)`;
    };

    return (
        <ToolContainer>
            <div className="flex items-center gap-4">
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-24 h-24 p-0 border-none rounded-md cursor-pointer" />
                <div className="w-full space-y-2">
                    <Input readOnly value={color.toUpperCase()} />
                    <Input readOnly value={hexToRgb(color) || ''} />
                    <Input readOnly value={hexToHsl(color) || ''} />
                </div>
            </div>
            <div className="h-24 w-full rounded-md" style={{ backgroundColor: color }}></div>
        </ToolContainer>
    );
};

export const TextToSpeech: React.FC = () => {
    const [text, setText] = useState('Hello, world! This is a test of the text-to-speech API.');
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string | undefined>(undefined);
    const [languages, setLanguages] = useState<string[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState('en');

    const populateVoiceList = useCallback(() => {
        const newVoices = window.speechSynthesis.getVoices();
        setVoices(newVoices);
        const langSet = new Set(newVoices.map(v => v.lang.split('-')[0]));
        setLanguages(Array.from(langSet).sort());
    }, []);

    useEffect(() => {
        populateVoiceList();
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = populateVoiceList;
        }
    }, [populateVoiceList]);
    
    const handleSpeak = () => {
        if (!text) return;
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = voices.find(v => v.voiceURI === selectedVoice);
        if (voice) {
            utterance.voice = voice;
        }
        window.speechSynthesis.speak(utterance);
    };

    const filteredVoices = voices.filter(v => v.lang.startsWith(selectedLanguage));

    return (
        <ToolContainer>
            <textarea value={text} onChange={e => setText(e.target.value)} rows={5} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full focus:outline-none focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] transition-colors"></textarea>
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <label htmlFor="lang-select" className="block mb-1">Language</label>
                    <Select id="lang-select" value={selectedLanguage} onChange={e => setSelectedLanguage(e.target.value)}>
                        {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                    </Select>
                </div>
                <div className="flex-1">
                    <label htmlFor="voice-select" className="block mb-1">Voice</label>
                    <Select id="voice-select" value={selectedVoice} onChange={e => setSelectedVoice(e.target.value)}>
                         {filteredVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}
                    </Select>
                </div>
            </div>
            <Button onClick={handleSpeak}>Speak</Button>
        </ToolContainer>
    );
};

export const SpeechToText: React.FC = () => {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setTranscript("Sorry, your browser doesn't support the Web Speech API.");
            return;
        }
        
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            setTranscript(prev => prev + finalTranscript);
        };
        
        recognitionRef.current = recognition;

        return () => {
          recognition.stop();
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setTranscript(''); // Clear previous transcript on start
            recognitionRef.current.start();
        }
        setIsListening(!isListening);
    };

    return (
        <ToolContainer>
            <Button onClick={toggleListening}>{isListening ? 'Stop Listening' : 'Start Listening'}</Button>
            <div className="p-4 bg-[#1E1E2F] rounded-md min-h-[100px]">{transcript || (isListening ? 'Listening...' : 'Click "Start Listening" to begin.')}</div>
        </ToolContainer>
    );
};

export const JsonFormatter: React.FC = () => {
    const [input, setInput] = useState('');
    const [output, setOutput] = useState('');
    const [error, setError] = useState('');

    const formatJson = () => {
        if (!input.trim()) {
            setOutput('');
            setError('');
            return;
        }
        try {
            const parsed = JSON.parse(input);
            setOutput(JSON.stringify(parsed, null, 2));
            setError('');
        } catch (e: any) {
            setError(e.message);
            setOutput('');
        }
    };
    
    return (
        <ToolContainer>
            <textarea value={input} onChange={e => setInput(e.target.value)} rows={8} className="bg-[#1E1E2F] border-2 border-[#3A3D5B] text-[#EAEAEA] rounded-md p-2 w-full font-mono" placeholder="Paste JSON here..."></textarea>
            <Button onClick={formatJson}>Format</Button>
            {error && <div className="p-2 bg-red-900 text-red-200 rounded-md">{error}</div>}
            {output && <pre className="p-4 bg-[#1E1E2F] rounded-md overflow-x-auto text-sm">{output}</pre>}
        </ToolContainer>
    );
};

export const UnitConverter: React.FC = () => {
    const units = {
        length: { meters: 1, kilometers: 1000, miles: 1609.34, feet: 0.3048, inches: 0.0254 },
        weight: { grams: 1, kilograms: 1000, pounds: 453.592, ounces: 28.3495 },
        temperature: {
            celsius: (v: number) => v,
            fahrenheit: (v: number) => (v - 32) * 5/9,
            kelvin: (v: number) => v - 273.15
        },
    };

    const [category, setCategory] = useState<keyof typeof units>('length');
    const [fromUnit, setFromUnit] = useState('meters');
    const [toUnit, setToUnit] = useState('kilometers');
    const [value, setValue] = useState(1);
    const [result, setResult] = useState('');

    useEffect(() => {
        const catUnits = Object.keys(units[category]);
        setFromUnit(catUnits[0]);
        setToUnit(catUnits[1] || catUnits[0]);
    }, [category]);
    
    useEffect(() => {
        const convert = () => {
            if (category === 'temperature') {
                const tempUnits = units.temperature;
                const fromFunc = tempUnits[fromUnit as keyof typeof tempUnits];
                const baseValue = fromFunc(Number(value)); // to Celsius
                
                if (toUnit === 'celsius') setResult(baseValue.toFixed(2));
                else if (toUnit === 'fahrenheit') setResult(((baseValue * 9/5) + 32).toFixed(2));
                else if (toUnit === 'kelvin') setResult((baseValue + 273.15).toFixed(2));
            } else {
                const standardUnits = units[category];
                const fromFactor = standardUnits[fromUnit as keyof typeof standardUnits];
                const toFactor = standardUnits[toUnit as keyof typeof standardUnits];
                if (fromFactor && toFactor) {
                    const baseValue = Number(value) * fromFactor;
                    setResult((baseValue / toFactor).toPrecision(6));
                }
            }
        };
        convert();
    }, [value, fromUnit, toUnit, category]);

    return (
        <ToolContainer>
            <Select value={category} onChange={e => setCategory(e.target.value as any)}>
                {Object.keys(units).map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </Select>
            <div className="flex flex-col md:flex-row items-center gap-2">
                <div className="flex-1 w-full">
                  <Input type="number" value={value} onChange={e => setValue(Number(e.target.value))} />
                  <Select value={fromUnit} onChange={e => setFromUnit(e.target.value)} className="mt-1">
                      {Object.keys(units[category]).map(u => <option key={u} value={u}>{u}</option>)}
                  </Select>
                </div>
                <span className="font-bold text-2xl text-[#FFD700] p-2">=</span>
                 <div className="flex-1 w-full">
                    <Input type="text" readOnly value={result} className="font-bold text-center text-lg"/>
                    <Select value={toUnit} onChange={e => setToUnit(e.target.value)} className="mt-1">
                         {Object.keys(units[category]).map(u => <option key={u} value={u}>{u}</option>)}
                    </Select>
                </div>
            </div>
        </ToolContainer>
    );
};

export const BmiCalculator: React.FC = () => {
    const [weight, setWeight] = useState(70);
    const [height, setHeight] = useState(175);
    const [result, setResult] = useState<string | null>(null);

    const calculateBmi = () => {
        if (weight <= 0 || height <= 0) {
            setResult("Please enter valid weight and height.");
            return;
        }
        const hMeters = height / 100;
        const bmi = weight / (hMeters * hMeters);
        let category = '';
        if (bmi < 18.5) category = 'Underweight';
        else if (bmi < 24.9) category = 'Normal weight';
        else if (bmi < 29.9) category = 'Overweight';
        else category = 'Obesity';
        setResult(`Your BMI is ${bmi.toFixed(1)} (${category})`);
    };

    return (
        <ToolContainer>
            <div><label>Weight (kg):</label><Input type="number" value={weight} onChange={e => setWeight(Number(e.target.value))} /></div>
            <div><label>Height (cm):</label><Input type="number" value={height} onChange={e => setHeight(Number(e.target.value))} /></div>
            <Button onClick={calculateBmi}>Calculate BMI</Button>
            {result && <div className="text-xl p-4 bg-[#1E1E2F] rounded-md text-center text-[#FFD700]">{result}</div>}
        </ToolContainer>
    );
};

export const TimerStopwatch: React.FC = () => {
    const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');
    const [time, setTime] = useState(0);
    const [isActive, setIsActive] = useState(false);
    const [timerInput, setTimerInput] = useState(60);
    const intervalRef = useRef<number | null>(null);
    
    useEffect(() => {
        if (isActive) {
            const startTime = Date.now() - (mode === 'stopwatch' ? time * 1000 : 0);
            const timerEndTime = Date.now() + time * 1000;

            intervalRef.current = window.setInterval(() => {
                if (mode === 'stopwatch') {
                    setTime(Math.floor((Date.now() - startTime) / 1000));
                } else {
                    const newTime = Math.ceil((timerEndTime - Date.now()) / 1000);
                    setTime(newTime >= 0 ? newTime : 0);
                }
            }, 100);
        } else if (intervalRef.current) {
            clearInterval(intervalRef.current);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [isActive, mode]);

    useEffect(() => {
        if (mode === 'timer' && time <= 0 && isActive) {
            setIsActive(false);
            // Optionally play a sound
        }
    }, [time, mode, isActive]);

    const handleStartStop = () => setIsActive(!isActive);
    const handleReset = () => {
        setIsActive(false);
        setTime(mode === 'timer' ? timerInput : 0);
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        return `${mins}:${secs}`;
    };
    
    return (
        <ToolContainer>
            <div className="flex justify-center gap-4 mb-4">
                <Button onClick={() => { setMode('stopwatch'); setTime(0); setIsActive(false);}} className={mode === 'stopwatch' ? '' : 'opacity-50'}>Stopwatch</Button>
                <Button onClick={() => { setMode('timer'); setTime(timerInput); setIsActive(false);}} className={mode === 'timer' ? '' : 'opacity-50'}>Timer</Button>
            </div>
            {mode === 'timer' && !isActive && (
                <div className="flex items-center gap-2">
                    <label>Set Timer (seconds):</label>
                    <Input type="number" value={timerInput} onChange={e => {
                        const newTime = Number(e.target.value);
                        setTimerInput(newTime);
                        setTime(newTime);
                    }} />
                </div>
            )}
            <div className="text-6xl font-mono text-center p-8 bg-[#1E1E2F] rounded-md text-[#FFD700]">
                {formatTime(time)}
            </div>
            <div className="flex justify-center gap-4">
                <Button onClick={handleStartStop}>{isActive ? 'Pause' : 'Start'}</Button>
                <Button onClick={handleReset} variant="secondary">Reset</Button>
            </div>
        </ToolContainer>
    );
};

// --- NEW TOOL: Kiddo Fun World Stories ---
type StoryPage = { pageNumber: number; text: string; imageBase64: string; };
type ProgressItem = { pageNumber: number; status: string; textPreview?: string };

export const KiddoFunWorldStories: React.FC = () => {
    const { apiKeySelected, handleSelectKey, error: apiKeyError, resetApiKey, setError: setApiKeyError } = useApiKeyCheck();

    const [prompt, setPrompt] = useState('A little space bear who discovers a new star.');
    const [language, setLanguage] = useState('English');
    const [style, setStyle] = useState('Cartoon Book');
    const [pages, setPages] = useState(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [storyData, setStoryData] = useState<StoryPage[]>([]);
    const [currentPageIndex, setCurrentPageIndex] = useState(0);
    const [generationProgress, setGenerationProgress] = useState<ProgressItem[]>([]);

    const updateProgress = (pageNumber: number, status: string, textPreview?: string) => {
      setGenerationProgress(prev => {
        const existing = prev.find(p => p.pageNumber === pageNumber);
        if (existing) {
          return prev.map(p => p.pageNumber === pageNumber ? { ...p, status, textPreview: textPreview || p.textPreview } : p);
        }
        return [...prev, { pageNumber, status, textPreview }];
      });
    };

    const handleSuggestTopic = async () => {
        setIsGenerating(true);
        setLoadingMessage('Brainstorming fresh ideas...');
        setApiKeyError(null);
        try {
            const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: "Suggest a captivating story topic for a children's book.",
                config: {
                    systemInstruction: "You are a creative brainstorming assistant. Suggest one fun, original, and engaging story topic suitable for a 5-year-old, focusing on themes of friendship, exploration, or solving a mystery. The output must be JUST the story topic/title in English, nothing else.",
                    temperature: 1.0,
                },
            });
            const topic = response.text.trim().replace(/["“”]/g, '');
            if (topic) {
                setPrompt(topic);
            } else {
                setApiKeyError("Could not generate a topic. Try again.");
            }
        } catch (e: any) {
            console.error(e);
            setApiKeyError(`Failed to get topic suggestion: ${e.message}`);
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
        }
    };

    const handleGenerateStory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt) {
            setApiKeyError("Please enter a story topic.");
            return;
        }

        setIsGenerating(true);
        setStoryData([]);
        setGenerationProgress([]);
        setApiKeyError(null);

        let previousText = `Start the story about a ${prompt}.`;

        try {
            const ai = new GoogleGenAI({ apiKey: (process as any).env.API_KEY });

            for (let i = 1; i <= pages; i++) {
                setLoadingMessage(`Generating text for Page ${i}...`);
                updateProgress(i, 'Generating text...');

                // 1. Generate Text
                const textResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `Write the next page of a story about: ${prompt}. Previous page text: "${previousText}". Generate a new, single paragraph (max 4 sentences) in ${language}.`,
                    config: {
                        systemInstruction: `You are a friendly, engaging children's story writer. Write one short, simple, and exciting paragraph suitable for a single page of a ${pages}-page storybook. The style is "${style}". The final output MUST be only the story text, with no extra formatting, labels, or introduction. Write the story in the requested language: ${language}.`,
                        temperature: 0.9,
                    },
                });
                const text = textResponse.text.trim();
                previousText = text;
                updateProgress(i, 'Text complete. Generating image...', text);
                
                // 2. Generate Image
                setLoadingMessage(`Generating image for Page ${i}...`);
                const imagePrompt = style === 'Coloring Book'
                    ? `Black and white outline drawing, high contrast line art for a children's coloring book. Depict the scene described by: "${text}". Simple background, perfect for a child to color.`
                    : `A vibrant, high-quality, full-color illustration in a ${style} for a children's book. Depict the scene described by: "${text}". Suitable for a ${language} story.`;

                const imageResponse = await ai.models.generateImages({
                    model: 'imagen-4.0-generate-001',
                    prompt: imagePrompt,
                    config: { numberOfImages: 1, aspectRatio: '1:1', outputMimeType: 'image/jpeg' },
                });
                const imageBase64 = imageResponse.generatedImages[0].image.imageBytes;

                // 3. Store Page Data
                setStoryData(prev => [...prev, { pageNumber: i, text, imageBase64 }]);
                updateProgress(i, 'Complete', text);
            }
        } catch (e: any) {
            console.error(e);
            const errorMessage = e.message?.includes("Requested entity was not found")
                ? "Your API key is invalid. Please select a valid key."
                : `An error occurred: ${e.message}`;
            setApiKeyError(errorMessage);
            if (e.message?.includes("Requested entity was not found")) resetApiKey();
        } finally {
            setIsGenerating(false);
            setLoadingMessage('');
        }
    };

    const handleDownloadPDF = () => {
        if (storyData.length === 0 || !(window as any).jspdf) return;

        const { jsPDF } = (window as any).jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');
        const padding = 10;
        const pageWidth = doc.internal.pageSize.getWidth();
        const contentWidth = pageWidth - 2 * padding;

        storyData.forEach((page, index) => {
            if (index > 0) doc.addPage();
            
            const imgData = 'data:image/jpeg;base64,' + page.imageBase64;
            const imgWidth = contentWidth * 0.9;
            const imgX = (pageWidth - imgWidth) / 2;
            doc.addImage(imgData, 'JPEG', imgX, padding, imgWidth, imgWidth);

            doc.setFont('Poppins', 'normal');
            doc.setFontSize(14);
            doc.setTextColor(51, 51, 51);
            const splitText = doc.splitTextToSize(page.text, contentWidth);
            doc.text(splitText, pageWidth / 2, padding + imgWidth + 10, { align: 'center' });

            doc.setFontSize(10);
            doc.setTextColor(150, 150, 150);
            doc.text(`Page ${page.pageNumber}`, pageWidth / 2, doc.internal.pageSize.getHeight() - padding, { align: 'center' });
        });
        
        const safeName = prompt.replace(/[^a-z0-9]/gi, '_').toLowerCase().substring(0, 30);
        doc.save(`${safeName}_storybook.pdf`);
    };

    if (!apiKeySelected) {
        return <ApiKeyPrompt onSelectKey={handleSelectKey} error={apiKeyError} />;
    }

    const currentPage = storyData[currentPageIndex];

    return (
        <>
            <style>{`
                .font-poppins { font-family: 'Poppins', sans-serif; }
                .storybook-controls-bg { background-color: #FFFFFF; color: #1F2937; }
                .storybook-input { background-color: #FFFFFF; border-color: #D1D5DB; }
                .storybook-input:focus { border-color: #EF4444; ring-color: #EF4444; }
                .btn-primary-sb { background-color: #EF4444; color: white; }
                .btn-primary-sb:hover { background-color: #DC2626; }
                .btn-secondary-sb { background-color: #6366F1; color: white; }
                .btn-secondary-sb:hover { background-color: #4F46E5; }
                .book-page-view { box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.1); border: 2px solid #818CF8; min-height: 400px; }
            `}</style>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 font-poppins text-gray-800">
                {/* Controls */}
                <div className="lg:col-span-1 p-6 storybook-controls-bg rounded-xl shadow-2xl h-fit sticky top-8">
                    <h2 className="text-2xl font-bold mb-4">Book Settings</h2>
                    {isGenerating && loadingMessage && (
                        <div className="text-center p-4 bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-lg mb-4">
                            <svg className="animate-spin h-5 w-5 mr-3 inline text-yellow-600" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            <span>{loadingMessage}</span>
                        </div>
                    )}
                    {apiKeyError && <div className="p-3 mb-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">{apiKeyError}</div>}
                    <form onSubmit={handleGenerateStory} className="space-y-4">
                       <div>
                            <label htmlFor="prompt" className="block text-sm font-medium">Story Topic / Prompt</label>
                            <textarea id="prompt" rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} className="mt-1 block w-full rounded-md shadow-sm p-3 border storybook-input focus:ring focus:ring-opacity-50" placeholder="e.g., A little space bear who discovers a new star."></textarea>
                        </div>
                         <button type="button" onClick={handleSuggestTopic} disabled={isGenerating} className="w-full btn-secondary-sb rounded-md py-2 text-sm font-semibold shadow-md disabled:opacity-50">✨ Get a New & Exciting Topic</button>
                        <div>
                            <label htmlFor="language" className="block text-sm font-medium">Language</label>
                            <select id="language" value={language} onChange={e => setLanguage(e.target.value)} className="mt-1 block w-full rounded-md shadow-sm p-3 border storybook-input">
                                <option value="English">English</option><option value="Hindi">Hindi (हिंदी)</option><option value="Spanish">Spanish (Español)</option><option value="French">French (Français)</option><option value="Japanese">Japanese (日本語)</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="style" className="block text-sm font-medium">Book Style</label>
                            <select id="style" value={style} onChange={e => setStyle(e.target.value)} className="mt-1 block w-full rounded-md shadow-sm p-3 border storybook-input">
                                <option value="Cartoon Book">Cartoon Book</option><option value="Normal Story Book">Normal Story Book</option><option value="Comic Book">Comic Book</option><option value="Coloring Book">Coloring Book</option><option value="Anime Style">Anime Style</option>
                            </select>
                        </div>
                        <div>
                            <label htmlFor="pages" className="block text-sm font-medium">Number of Pages</label>
                            <input type="number" id="pages" min="3" max="10" value={pages} onChange={e => setPages(parseInt(e.target.value))} className="mt-1 block w-full rounded-md shadow-sm p-3 border storybook-input" />
                        </div>
                        <button type="submit" disabled={isGenerating} className="w-full btn-primary-sb rounded-md py-3 text-lg font-bold shadow-xl disabled:opacity-50">
                          {isGenerating ? 'Generating...' : `Generate ${pages}-Page Book`}
                        </button>
                    </form>
                    {storyData.length > 0 && !isGenerating && (
                      <div className="mt-6">
                          <hr className="my-6" />
                          <h3 className="text-xl font-bold mb-3">Download Options</h3>
                          <button type="button" onClick={handleDownloadPDF} className="w-full btn-secondary-sb rounded-md py-3 text-lg font-bold shadow-xl">⬇️ Download PDF</button>
                      </div>
                    )}
                </div>
                {/* Viewer / Progress */}
                <div className="lg:col-span-2 space-y-6">
                    {generationProgress.length > 0 && isGenerating && (
                        <div className="storybook-controls-bg p-6 rounded-xl shadow-2xl max-h-[600px] overflow-y-auto">
                            <h3 className="text-xl font-bold mb-4">Generation Progress</h3>
                            <ul className="space-y-3">
                                {generationProgress.map(p => (
                                    <li key={p.pageNumber} className={`flex items-center space-x-2 p-2 rounded-lg ${p.status.includes('Complete') ? 'bg-green-50' : 'bg-gray-50'}`}>
                                        <span className="text-lg">{p.status.includes('Complete') ? '✅' : '🔄'}</span>
                                        <span className="font-semibold">Page {p.pageNumber}:</span>
                                        <span>{p.status}</span>
                                        {p.textPreview && <p className="text-xs italic text-gray-500 mt-1 truncate">"{p.textPreview.substring(0, 50)}..."</p>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {storyData.length > 0 && !isGenerating && currentPage && (
                        <div className="storybook-controls-bg p-6 rounded-xl shadow-2xl">
                           <div className="book-page-view w-full p-6 text-center flex flex-col items-center justify-between bg-white">
                               <img src={`data:image/jpeg;base64,${currentPage.imageBase64}`} alt={`Illustration for page ${currentPage.pageNumber}`} className="w-full max-h-[500px] object-contain rounded-lg shadow-md mb-4"/>
                               <p className="text-lg md:text-xl font-medium p-4">{currentPage.text}</p>
                           </div>
                           <div className="flex justify-between items-center mt-4">
                               <button onClick={() => setCurrentPageIndex(p => p - 1)} disabled={currentPageIndex === 0} className="p-3 bg-gray-300 rounded-full hover:bg-gray-400 disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg></button>
                               <span className="text-lg font-semibold">{`Page ${currentPageIndex + 1} / ${storyData.length}`}</span>
                               <button onClick={() => setCurrentPageIndex(p => p + 1)} disabled={currentPageIndex === storyData.length - 1} className="p-3 bg-gray-300 rounded-full hover:bg-gray-400 disabled:opacity-50"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg></button>
                           </div>
                        </div>
                    )}
                    {!isGenerating && storyData.length === 0 && (
                        <div className="storybook-controls-bg p-12 rounded-xl shadow-2xl text-center">
                            <p className="text-xl text-gray-500">Enter your story idea and hit 'Generate' to see the magic appear!</p>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};