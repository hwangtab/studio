import React from 'react';
import { Field, TextInput } from '../ui/Field';

interface InputFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon: React.ElementType;
  label: string;
  id: string;
  error?: string;
}

type IconInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  icon: React.ElementType;
  invalid?: boolean;
};

/**
 * 아이콘 슬롯은 `Field`가 담지 못한다 — 컨트롤을 relative 래퍼로 감싸야 하기 때문이다.
 * 래퍼만 여기서 만들고 컨트롤 자체는 공용 `TextInput`을 쓴다. `Field`가 주입하는
 * id·aria-*는 그대로 `TextInput`으로 흘려보낸다(invalid는 아래에서 직접 넘긴다 —
 * `Field`는 TextInput/TextArea/Select 3종에만 invalid를 주입한다).
 */
const IconInput = ({ icon: Icon, invalid, className, ...props }: IconInputProps) => (
  <div className="relative">
    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
      <Icon className="w-5 h-5 text-gray-400 dark:text-gray-400" aria-hidden="true" />
    </div>
    <TextInput invalid={invalid} className={['pl-10', className].filter(Boolean).join(' ')} {...props} />
  </div>
);

const InputField = ({ icon, label, id, error, ...props }: InputFieldProps) => (
  <Field id={id} label={label} required={props.required} error={error} className="mb-4">
    <IconInput icon={icon} invalid={!!error} {...props} />
  </Field>
);

export default InputField;
