#include "audio.h"
#include "../config/config.h"
#include "../diagnostics/diagnostics.h"

AudioPlayer audioPlayer;

void AudioPlayer::begin() {
    _isPlaying = false;
}

void AudioPlayer::play(const char* filename) {
    if (_isPlaying) stop();

    diagnostics.info(ModuleID::System, (String("Playing Non-Blocking: ") + filename).c_str());

    // Do NOT re-initialize SPI or SD. It breaks the TFT and LFN cache.
    // Just open the file!
    _audioFile = SD.open(filename);
    if (!_audioFile) {
        diagnostics.error(ModuleID::System, (String(filename) + " not found").c_str());
        return;
    }

    // --- Parse WAV header ---
    uint16_t numChannels  = 1;
    uint32_t sampleRate   = 44100;
    uint16_t bitsPerSample = 16;
    _audioFile.seek(22); _audioFile.read((uint8_t*)&numChannels,   2);
    _audioFile.seek(24); _audioFile.read((uint8_t*)&sampleRate,    4);
    _audioFile.seek(34); _audioFile.read((uint8_t*)&bitsPerSample, 2);
    _audioFile.seek(44); // PCM data starts at byte 44

    // --- Install I2S driver ---
    gpio_reset_pin((gpio_num_t)I2S_BCLK);
    gpio_reset_pin((gpio_num_t)I2S_LRC);
    gpio_reset_pin((gpio_num_t)I2S_DOUT);

    i2s_channel_fmt_t chanFmt = (numChannels == 1)
        ? I2S_CHANNEL_FMT_ONLY_RIGHT
        : I2S_CHANNEL_FMT_RIGHT_LEFT;

    i2s_config_t i2s_cfg = {
        .mode                 = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate          = sampleRate,
        .bits_per_sample      = (i2s_bits_per_sample_t)bitsPerSample,
        .channel_format       = chanFmt,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags     = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count        = 8,
        .dma_buf_len          = 512,
        .use_apll             = false,
        .tx_desc_auto_clear   = true,
    };
    i2s_pin_config_t pin_cfg = {
        .bck_io_num   = I2S_BCLK,
        .ws_io_num    = I2S_LRC,
        .data_out_num = I2S_DOUT,
        .data_in_num  = I2S_PIN_NO_CHANGE,
    };

    if (i2s_driver_install(I2S_NUM_0, &i2s_cfg, 0, NULL) != ESP_OK) {
        diagnostics.error(ModuleID::System, "I2S install failed");
        _audioFile.close();
        return;
    }
    i2s_set_pin(I2S_NUM_0, &pin_cfg);
    i2s_zero_dma_buffer(I2S_NUM_0);

    _isPlaying = true;
}

void AudioPlayer::update() {
    if (!_isPlaying) return;

    // Pump as much data as the DMA buffer will accept without blocking
    while (_audioFile.available()) {
        uint8_t buf[512];
        int bytes_read = _audioFile.read(buf, sizeof(buf));
        if (bytes_read > 0) {
            size_t bytes_written = 0;
            // Use 0 ticks to check if there is space in the DMA buffer.
            // If it returns quickly with bytes_written < bytes_read, the buffer is full!
            i2s_write(I2S_NUM_0, buf, bytes_read, &bytes_written, 0);
            
            if (bytes_written < bytes_read) {
                // The DMA buffer is completely full! 
                // We must rewind the SD file position by the amount of data we failed to write
                // so we don't skip any audio.
                _audioFile.seek(_audioFile.position() - (bytes_read - bytes_written));
                break; // Stop pumping, buffer is full
            }
        } else {
            break;
        }
    }

    if (!_audioFile.available()) {
        stop();
    }
}

void AudioPlayer::stop() {
    if (_isPlaying) {
        _isPlaying = false;
        if (_audioFile) {
            _audioFile.close();
        }
        i2s_zero_dma_buffer(I2S_NUM_0);
        i2s_driver_uninstall(I2S_NUM_0);
        diagnostics.info(ModuleID::System, "Playback stopped");
    }
}
