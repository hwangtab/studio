const React = require('react');

const MockIcon = React.forwardRef(function MockIcon(props, ref) {
  return React.createElement('svg', {
    ...props,
    ref,
    'aria-hidden': props['aria-hidden'] ?? true,
    'data-testid': props['data-testid'] ?? 'lucide-icon',
  });
});

module.exports = MockIcon;
module.exports.default = MockIcon;
