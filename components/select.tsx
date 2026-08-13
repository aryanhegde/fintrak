"use client";

import * as React from "react";

import {
  components,
  InputProps,
  SelectInstance,
  SingleValue,
} from "react-select";
import CreateableSelect from "react-select/creatable";

type Option = { label: string; value: string };

type Props = {
  onChange: (value?: string) => void;
  onCreate?: (value: string) => void;
  options?: Option[];
  value?: string | null | undefined;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  inputId?: string;
  "aria-label"?: React.AriaAttributes["aria-label"];
  "aria-describedby"?: React.AriaAttributes["aria-describedby"];
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
};

export const Select = React.forwardRef<SelectInstance<Option>, Props>(
  (
    {
      onChange,
      onCreate,
      disabled,
      options = [],
      placeholder,
      value,
      id,
      inputId,
      "aria-label": ariaLabel,
      "aria-describedby": ariaDescribedBy,
      "aria-invalid": ariaInvalid,
    },
    ref
  ) => {
    const onSelect = (option: SingleValue<Option>) => {
      onChange(option?.value);
    };

    const formattedValue = React.useMemo(() => {
      return options.find((option) => option.value === value);
    }, [options, value]);

    const Input = React.useMemo(
      () =>
        function SelectInput(inputProps: InputProps<Option, false>) {
          return (
            <components.Input
              {...inputProps}
              aria-describedby={
                ariaDescribedBy ?? inputProps["aria-describedby"]
              }
            />
          );
        },
      [ariaDescribedBy]
    );

    return (
      <CreateableSelect
        ref={ref}
        inputId={inputId ?? id}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid}
        placeholder={placeholder}
        className="text-sm h-10"
        components={{ Input }}
        styles={{
          control: (base) => ({
            ...base,
            borderColor: "#e2e8f0",
            ":hover": {
              borderColor: "#e2e8f0",
            },
          }),
        }}
        value={formattedValue}
        onChange={onSelect}
        options={options}
        onCreateOption={onCreate}
        isDisabled={disabled}
      />
    );
  }
);

Select.displayName = "Select";
