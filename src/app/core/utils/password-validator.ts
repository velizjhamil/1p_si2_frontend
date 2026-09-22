import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export interface PasswordRequisitos {
  minLength: boolean;
  hasUpper: boolean;
  hasLower: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
  tieneLongitudMinima: boolean;
  tieneMayuscula: boolean;
  tieneMinuscula: boolean;
  tieneNumero: boolean;
  tieneEspecial: boolean;
}

/**
 * Evalúa los 5 criterios de contraseña segura:
 * 1. Mínimo 8 caracteres
 * 2. Al menos una letra mayúscula (A-Z)
 * 3. Al menos una letra minúscula (a-z)
 * 4. Al menos un dígito numérico (0-9)
 * 5. Al menos un carácter especial (@$!%*?&._#\-+=~^<>/\\|)
 */
export function evaluarRequisitosPassword(password: string | null | undefined): PasswordRequisitos {
  const p = password || '';
  const minLength = p.length >= 8;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecial = /[@$!%*?&._#\-+=~^<>/\\|]/.test(p);

  return {
    minLength,
    hasUpper,
    hasLower,
    hasNumber,
    hasSpecial,
    isValid: minLength && hasUpper && hasLower && hasNumber && hasSpecial,
    tieneLongitudMinima: minLength,
    tieneMayuscula: hasUpper,
    tieneMinuscula: hasLower,
    tieneNumero: hasNumber,
    tieneEspecial: hasSpecial,
  };
}

/**
 * Validador reactivo de Angular para formularios.
 * @param requerido Si es true, el valor vacío falla con required. Si es false (en edición opcional), vacío es válido.
 */
export function passwordSeguraValidator(requerido: boolean = true): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const val = control.value;
    if (!val || val.trim().length === 0) {
      return requerido ? { required: true } : null;
    }

    const evaluacion = evaluarRequisitosPassword(val);
    if (evaluacion.isValid) {
      return null;
    }

    return {
      passwordInsegura: {
        minLength: !evaluacion.minLength,
        hasUpper: !evaluacion.hasUpper,
        hasLower: !evaluacion.hasLower,
        hasNumber: !evaluacion.hasNumber,
        hasSpecial: !evaluacion.hasSpecial,
      },
    };
  };
}
