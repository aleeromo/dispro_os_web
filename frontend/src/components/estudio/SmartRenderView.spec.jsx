import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SmartRenderView } from './SmartRenderView.jsx';

describe('SmartRenderView', () => {
  const defaultProps = {
    isDarkMode: false,
    resultado: null,
    preview: null,
    imgData: { wPx: 800, hPx: 600 },
    bgMontaje: null,
    setBgMontaje: vi.fn(),
    bgInputRef: { current: null },
    conLuz: true,
  };

  it('renderiza mensaje cuando no hay resultado ni SVG', () => {
    render(<SmartRenderView {...defaultProps} />);
    expect(screen.getByText(/Analiza el diseño para ver el render 3D/i)).toBeInTheDocument();
  });

  it('muestra toggle Iluminación LED', () => {
    render(<SmartRenderView {...defaultProps} />);
    expect(screen.getByText(/Iluminación LED/i)).toBeInTheDocument();
  });

  it('muestra botones Subir Fachada y Ver en AR', () => {
    render(<SmartRenderView {...defaultProps} />);
    expect(screen.getByRole('button', { name: /Subir Fachada/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ver en AR/i })).toBeInTheDocument();
  });

  it('renderiza área 3D cuando hay resultado con svg_path_d', () => {
    const resultado = {
      svg_path_d: '<svg viewBox="0 0 1 1"><path d="M0 0 L1 0 L1 1 Z" data-type="letra3d" data-mat="acrilico" data-col="#fff" /></svg>',
      img_w_m: 1,
      img_h_m: 0.5,
    };
    render(<SmartRenderView {...defaultProps} resultado={resultado} />);
    expect(screen.queryByText(/Analiza el diseño para ver el render 3D/i)).not.toBeInTheDocument();
  });
});
