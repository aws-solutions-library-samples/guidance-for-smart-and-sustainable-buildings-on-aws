from smbus2 import SMBus


class BME280:
    def __init__(self, bus_number=1, i2c_address=0x76):
        self.bus = SMBus(bus_number)
        self.i2c_address = i2c_address
        self.dig_t = []
        self.dig_p = []
        self.dig_h = []
        self.t_fine = 0.0

    def write_reg(self, reg_address, data):
        """Write data to the register"""
        self.bus.write_byte_data(self.i2c_address, reg_address, data)

    def get_calib_param(self):
        """Get calibration parameters"""
        calib = []
        for i in range(0x88, 0x88 + 24):
            calib.append(self.bus.read_byte_data(self.i2c_address, i))
        calib.append(self.bus.read_byte_data(self.i2c_address, 0xA1))
        for i in range(0xE1, 0xE1 + 7):
            calib.append(self.bus.read_byte_data(self.i2c_address, i))

        self.dig_t.append((calib[1] << 8) | calib[0])
        self.dig_t.append((calib[3] << 8) | calib[2])
        self.dig_t.append((calib[5] << 8) | calib[4])
        self.dig_p.append((calib[7] << 8) | calib[6])
        self.dig_p.append((calib[9] << 8) | calib[8])
        self.dig_p.append((calib[11] << 8) | calib[10])
        self.dig_p.append((calib[13] << 8) | calib[12])
        self.dig_p.append((calib[15] << 8) | calib[14])
        self.dig_p.append((calib[17] << 8) | calib[16])
        self.dig_p.append((calib[19] << 8) | calib[18])
        self.dig_p.append((calib[21] << 8) | calib[20])
        self.dig_p.append((calib[23] << 8) | calib[22])
        self.dig_h.append(calib[24])
        self.dig_h.append((calib[26] << 8) | calib[25])
        self.dig_h.append(calib[27])
        self.dig_h.append((calib[28] << 4) | (0x0F & calib[29]))
        self.dig_h.append((calib[30] << 4) | ((calib[29] >> 4) & 0x0F))
        self.dig_h.append(calib[31])

        self._update_dig_t()
        self._update_dig_p()
        self._update_dig_h()

    def _update_dig_t(self):
        """Update dig_t correction"""
        for i in range(1, 2):
            if self.dig_t[i] & 0x8000:
                self.dig_t[i] = (-self.dig_t[i] ^ 0xFFFF) + 1

    def _update_dig_p(self):
        """Update dig_p correction"""
        for i in range(1, 8):
            if self.dig_p[i] & 0x8000:
                self.dig_p[i] = (-self.dig_p[i] ^ 0xFFFF) + 1

    def _update_dig_h(self):
        """Update dig_h correction"""
        for i in range(0, 6):
            if self.dig_h[i] & 0x8000:
                self.dig_h[i] = (-self.dig_h[i] ^ 0xFFFF) + 1

    def read_data(self):
        """Read sensor data"""
        data = []
        for i in range(0xF7, 0xF7 + 8):
            data.append(self.bus.read_byte_data(self.i2c_address, i))
        pres_raw = (data[0] << 12) | (data[1] << 4) | (data[2] >> 4)
        temp_raw = (data[3] << 12) | (data[4] << 4) | (data[5] >> 4)
        hum_raw = (data[6] << 8) | data[7]

        temperature = self.compensate_temp(temp_raw)
        pressure = self.compensate_pres(pres_raw)
        humidity = self.compensate_humi(hum_raw)

        return {
            "temperature": temperature,
            "pressure": pressure,
            "humidity": humidity
        }

    def compensate_pres(self, adc_p):
        """Compensate pressure"""
        v1 = (self.t_fine / 2.0) - 64000.0
        v2 = (((v1 / 4.0) * (v1 / 4.0)) / 2048) * self.dig_p[5]
        v2 = v2 + ((v1 * self.dig_p[4]) * 2.0)
        v2 = (v2 / 4.0) + (self.dig_p[3] * 65536.0)
        v1 = (((self.dig_p[2] * (((v1 / 4.0) * (v1 / 4.0)) / 8192)) / 8) + ((self.dig_p[1] * v1) / 2.0)) / 262144
        v1 = ((32768 + v1) * self.dig_p[0]) / 32768

        if v1 == 0:
            return 0
        pressure = ((1048576 - adc_p) - (v2 / 4096)) * 3125
        if pressure < 0x80000000:
            pressure = (pressure * 2.0) / v1
        else:
            pressure = (pressure / v1) * 2
        v1 = (self.dig_p[8] * (((pressure / 8.0) * (pressure / 8.0)) / 8192.0)) / 4096
        v2 = ((pressure / 4.0) * self.dig_p[7]) / 8192.0
        pressure = pressure + ((v1 + v2 + self.dig_p[6]) / 16.0)
        return pressure / 100

    def compensate_temp(self, adc_t):
        """Compensate temperature"""
        v1 = (adc_t / 16384.0 - self.dig_t[0] / 1024.0) * self.dig_t[1]
        v2 = (adc_t / 131072.0 - self.dig_t[0] / 8192.0) * (adc_t / 131072.0 - self.dig_t[0] / 8192.0) * self.dig_t[2]
        self.t_fine = v1 + v2
        temperature = self.t_fine / 5120.0
        return temperature

    def compensate_humi(self, adc_h):
        """Compensate humidity"""
        var_h = self.t_fine - 76800.0
        if var_h != 0:
            var_h = (adc_h - (self.dig_h[3] * 64.0 + self.dig_h[4] / 16384.0 * var_h)) * (
                        self.dig_h[1] / 65536.0 * (1.0 + self.dig_h[5] / 67108864.0 * var_h * (
                            1.0 + self.dig_h[2] / 67108864.0 * var_h)))
        else:
            return 0
        var_h = var_h * (1.0 - self.dig_h[0] * var_h / 524288.0)
        if var_h > 100.0:
            var_h = 100.0
        elif var_h < 0.0:
            var_h = 0.0
        return var_h

    def setup(self):
        """Set up the sensor"""
        osrs_t = 1  # Temperature oversampling x 1
        osrs_p = 1  # Pressure oversampling x 1
        osrs_h = 1  # Humidity oversampling x 1
        mode = 3  # Normal mode
        t_sb = 5  # Tstandby 1000ms
        filter_coeff = 0  # Filter off
        spi3w_en = 0  # 3-wire SPI Disable

        ctrl_meas_reg = (osrs_t << 5) | (osrs_p << 2) | mode
        config_reg = (t_sb << 5) | (filter_coeff << 2) | spi3w_en
        ctrl_hum_reg = osrs_h

        self.write_reg(0xF2, ctrl_hum_reg)
        self.write_reg(0xF4, ctrl_meas_reg)
        self.write_reg(0xF5, config_reg)


if __name__ == '__main__':
    bme280 = BME280()
    bme280.setup()
    bme280.get_calib_param()

    try:
        while True:
            data = bme280.read_data()
            print(f"Temperature: {data['temperature']:.2f} °C")
            print(f"Pressure: {data['pressure']:.2f} hPa")
            print(f"Humidity: {data['humidity']:.2f} %")
    except KeyboardInterrupt:
        pass