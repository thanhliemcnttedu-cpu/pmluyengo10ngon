import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const root = createRoot(document.getElementById('root')!);
const isDevicesRoute = () => window.location.hash.startsWith('#/devices');

// Trang xem thử theo thiết bị (#/devices) chỉ có khi phát triển; bản build bỏ hẳn đoạn này
if (import.meta.env.DEV && isDevicesRoute()) {
  import('./dev/DevicePreview').then(({ DevicePreview }) => root.render(<DevicePreview />));
} else {
  // Bọc toàn bộ ứng dụng: lỗi bất ngờ hiện màn hình khôi phục thay vì trang trắng
  root.render(
    <ErrorBoundary fallbackTitle="Phần mềm gặp lỗi, bấm thử lại để tiếp tục luyện gõ">
      <App />
    </ErrorBoundary>
  );
}

if (import.meta.env.DEV) {
  // Đổi qua lại giữa phần mềm và trang xem thử bằng cách sửa địa chỉ -> nạp lại cho đúng giao diện
  let wasDevices = isDevicesRoute();
  window.addEventListener('hashchange', () => {
    if (isDevicesRoute() !== wasDevices) {
      wasDevices = isDevicesRoute();
      window.location.reload();
    }
  });
  console.info('Xem thử theo thiết bị: ' + window.location.origin + '/#/devices?d=all&p=/');
}
