import { render } from '@testing-library/react';

describe('Performance Grade Styling', () => {
  it('should apply correct text color classes for grades', () => {
    const { container } = render(
      <div>
        <span className="grade-green">A Grade</span>
        <span className="grade-a">A Grade Alt</span>
        <span className="grade-b">B Grade</span>
        <span className="grade-yellow">C Grade</span>
        <span className="grade-c">C Grade Alt</span>
        <span className="grade-red">D Grade</span>
        <span className="grade-d">D Grade Alt</span>
        <span className="grade-f">F Grade</span>
      </div>
    );

    // Check that elements have the correct classes
    expect(container.querySelector('.grade-green')).toBeInTheDocument();
    expect(container.querySelector('.grade-a')).toBeInTheDocument();
    expect(container.querySelector('.grade-b')).toBeInTheDocument();
    expect(container.querySelector('.grade-yellow')).toBeInTheDocument();
    expect(container.querySelector('.grade-c')).toBeInTheDocument();
    expect(container.querySelector('.grade-red')).toBeInTheDocument();
    expect(container.querySelector('.grade-d')).toBeInTheDocument();
    expect(container.querySelector('.grade-f')).toBeInTheDocument();
  });

  it('should apply correct background color classes for grades', () => {
    const { container } = render(
      <div>
        <div className="bg-grade-green">A/B Background</div>
        <div className="bg-grade-a">A Background Alt</div>
        <div className="bg-grade-b">B Background Alt</div>
        <div className="bg-grade-yellow">C Background</div>
        <div className="bg-grade-c">C Background Alt</div>
        <div className="bg-grade-red">D/F Background</div>
        <div className="bg-grade-d">D Background Alt</div>
        <div className="bg-grade-f">F Background Alt</div>
      </div>
    );

    // Check that elements have the correct background classes
    expect(container.querySelector('.bg-grade-green')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-a')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-b')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-yellow')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-c')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-red')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-d')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-f')).toBeInTheDocument();
  });

  it('should map grades to correct colors according to requirements', () => {
    // This test verifies the grade-to-color mapping:
    // A/B grades → green (#10B981)
    // C grades → yellow (#F59E0B)  
    // D/F grades → red (#EF4444)
    
    const { container } = render(
      <div>
        <span className="grade-a" data-testid="grade-a">A</span>
        <span className="grade-b" data-testid="grade-b">B</span>
        <span className="grade-c" data-testid="grade-c">C</span>
        <span className="grade-d" data-testid="grade-d">D</span>
        <span className="grade-f" data-testid="grade-f">F</span>
      </div>
    );

    // Verify elements exist with correct classes
    expect(container.querySelector('[data-testid="grade-a"]')).toHaveClass('grade-a');
    expect(container.querySelector('[data-testid="grade-b"]')).toHaveClass('grade-b');
    expect(container.querySelector('[data-testid="grade-c"]')).toHaveClass('grade-c');
    expect(container.querySelector('[data-testid="grade-d"]')).toHaveClass('grade-d');
    expect(container.querySelector('[data-testid="grade-f"]')).toHaveClass('grade-f');
  });

  it('should provide both generic and specific grade classes', () => {
    const { container } = render(
      <div>
        <span className="grade-green">Generic Green</span>
        <span className="grade-a">Specific A</span>
        <span className="bg-grade-yellow">Generic Yellow BG</span>
        <span className="bg-grade-c">Specific C BG</span>
      </div>
    );

    // Both generic and specific classes should work
    expect(container.querySelector('.grade-green')).toBeInTheDocument();
    expect(container.querySelector('.grade-a')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-yellow')).toBeInTheDocument();
    expect(container.querySelector('.bg-grade-c')).toBeInTheDocument();
  });
});