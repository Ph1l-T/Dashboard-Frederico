# To-do Frederico

Atualizado em: 2026-06-10

## Estado atual

- [x] Base do cliente Frederico criada no `config.js`.
- [x] Supabase/auth deixado desligado por enquanto.
- [x] Chaves Supabase removidas do frontend.
- [x] Ambientes principais cadastrados.
- [x] Nomes das luzes listadas foram cadastrados sem os numeros entre parenteses.
- [x] IDs temporarios `PENDING-FRED-*` criados para manter a interface montada.
- [x] Identidade do app atualizada para Dashboard Frederico.
- [x] Confirmado que todas as televisoes da casa serao LG.
- [x] Driver `TVLG_DriverIR_GW8.groovy` criado com os codigos IR LG embutidos e transporte nativo do GW8.
- [x] Brand LG configurada no dashboard com os comandos e capacidades do driver GW8.
- [x] Driver `AC LG GW8.groovy` mapeado no dashboard para os ar-condicionados LG.
- [x] IDs reais encontrados em `drivers/all.json` aplicados para luzes de Home, Living/Jantar, Varanda e ACs LG localizados.

## Pendencias principais

- [ ] Substituir os IDs `PENDING-FRED-*` restantes pelos IDs reais dos dispositivos no Hubitat.
- [ ] Confirmar se cada luz sera switch simples ou dimmer.
- [ ] Completar os nomes das luzes dos ambientes onde ainda constam apenas como `Luzes`.
- [ ] Confirmar se algum ambiente tera cortinas, persianas, toldos ou telas moveis.
- [ ] Confirmar se algum ambiente tera musica/audio dedicado.
- [ ] Confirmar se algum ambiente tera HTV, Apple TV, Claro TV, Roku, Blu-ray ou outro controle alem de Televisao.
- [ ] Revisar e validar os comandos reais das TVs LG de cada ambiente.
- [ ] Revisar comandos reais de ar-condicionado de cada ambiente.
- [ ] Definir fotos reais dos ambientes ou manter placeholder.
- [ ] Limpar rotas/macros antigas que nao serao usadas no projeto Frederico.

## Driver LG IR para GW8

- [x] Preservar os 24 codigos IR do driver LG original.
- [x] Trocar a autenticacao do GW3 por usuario e senha do GW8.
- [x] Enviar os comandos pelo endpoint nativo `/control` do GW8.
- [x] Permitir a configuracao do canal infravermelho de 1 a 8.
- [x] Manter os comandos originais e adicionar aliases usados pelo dashboard.
- [x] Mapear a brand `lg` para energia, canais, menu, mute, home, HDMI 2, cursor e numeros.
- [x] Enviar o mute LG diretamente ao driver IR.
- [x] Remover do controle LG os comandos de volume e midia nao suportados pelo driver atual.
- [ ] Instalar `drivers/TVLG_DriverIR_GW8.groovy` no Hubitat.
- [ ] Configurar IP, usuario, senha e canal do GW8 no dispositivo virtual.
- [ ] Confirmar qual canal fisico do GW8 sera usado para cada televisao.
- [ ] Testar os 24 comandos em uma TV LG real.
- [ ] Verificar os logs de retorno HTTP do GW8 durante os testes.

## Driver AC LG para GW8

- [x] Criar perfil `airConditionerBrands.lg` no `config.js`.
- [x] Mapear energia para `AC_lg_ON` e `AC_lg_OFF`.
- [x] Mapear temperaturas de 18 a 25 com `AC_lg_{temp}`.
- [x] Mapear aletas para `AC_lg_swing_on` e `AC_lg_swing_off`.
- [x] Ajustar os ACs cadastrados para `brand: "lg"`.
- [x] Limitar os controles visuais dos ACs LG ao intervalo 18-25.
- [ ] Instalar `drivers/AC LG GW8.groovy` no Hubitat.
- [ ] Configurar IP, usuario, senha e canal do GW8 em cada dispositivo virtual de AC.
- [ ] Confirmar qual canal fisico do GW8 sera usado para cada ar-condicionado.
- [ ] Testar ON, OFF, 18-25 e swing em um ar-condicionado LG real.
- [ ] Verificar se o formato `NUMERIC_GC` funciona no GW8; se falhar, testar `FULL_SENDIR` ou `FULL_SENDIR_CHANNEL`.

## IDs importados do Hubitat

- [x] Home: luzes `6`, `7`, `8` e AC LG `64`.
- [x] Living/Jantar: luzes `9` a `17` e dimmers `45`, `46`, `47`.
- [x] Varanda: luzes `18`, `19`, `20`, `21`, `23` e dimmers `42`, `43`, `44`.
- [x] Suite I: AC LG `59`.
- [x] Suite II: AC LG `60`.
- [x] Suite Master: AC LG `61` e AC Closet `62`.
- [x] Escritorio: AC LG `63`.
- [x] Cozinha: AC LG `65`.
- [ ] Sem correspondencia no `all.json`: televisoes LG.
- [ ] Sem correspondencia no `all.json`: luzes das suites e escritorio que ainda constam como `Luzes`.

## IDs por ambiente

### Ambiente 1: Home

- [x] Luz: Spots - ID `6`
- [x] Luz: Barra LED - ID `7`
- [x] Luz: Sanca - ID `8`
- [x] Ar-condicionado - ID `64`
- [ ] Televisao LG

### Ambiente 2: Living/Jantar

- [x] Luz: Sanca NC - ID `10`
- [x] Luz: Spots Parede - ID `11`
- [x] Luz: Spots Hall - ID `9`
- [x] Luz: Spots Living - ID `12`
- [x] Luz: Spots Centrais - ID `13`
- [x] Luz: Spots Pilar - ID `14`
- [x] Luz: Spots Movel - ID `15`
- [x] Luz: Spots Mesa - ID `16`
- [x] Luz: Spots Jantar - ID `17`
- [x] Luz dimmer: Lustre Dimmer - ID `47`
- [x] Luz dimmer: Spots Centro Dimmer - ID `46`
- [x] Luz dimmer: Spots Dimmer - ID `45`

### Ambiente 3: Cozinha

- [ ] Confirmar se havera luzes, TV ou outros dispositivos.
- [x] Ar-condicionado - ID `65`

### Ambiente 4: Varanda

- [x] Luz: Sanca NC - ID `18`
- [x] Luz: Spots Varanda - ID `19`
- [x] Luz: Spots Centro - ID `20`
- [x] Luz: Spots Gourmet - ID `21`
- [x] Luz: Spots Balcao NC - ID `23`
- [x] Luz dimmer: Spots Balcao Dimmer - ID `42`
- [x] Luz dimmer: Spots Centro Dimmer - ID `44`
- [x] Luz dimmer: Spots Dimmer - ID `43`

### Ambiente 5: Suite I

- [ ] Completar nomes das luzes
- [x] Ar-condicionado - ID `59`
- [ ] Televisao LG

### Ambiente 6: Suite II

- [ ] Completar nomes das luzes
- [x] Ar-condicionado - ID `60`
- [ ] Televisao LG

### Ambiente 7: Suite Master

- [ ] Completar nomes das luzes
- [x] Ar-condicionado: AC: Suite Master - ID `61`
- [x] Ar-condicionado: AC: Closet - ID `62`
- [ ] Televisao LG

### Ambiente 8: Escritorio

- [ ] Completar nomes das luzes
- [x] Ar-condicionado - ID `63`
- [ ] Televisao LG

## Supabase e permissoes

- [ ] Decidir se sera criado um projeto Supabase novo para Frederico.
- [ ] Configurar `SUPABASE_URL` e `SUPABASE_ANON_KEY` somente quando a integracao for iniciada.
- [ ] Rodar migrations de cenas e controle de acesso.
- [ ] Cadastrar usuarios autorizados.
- [ ] Popular `environment_device_registry` com os IDs reais.
- [ ] Definir permissoes por usuario/ambiente.

## Cloudflare e deploy

- [ ] Criar/configurar projeto Cloudflare Pages.
- [ ] Configurar secrets/variaveis de ambiente.
- [ ] Definir `HUBITAT_BASE_URL`.
- [ ] Definir `HUBITAT_ACCESS_TOKEN`.
- [ ] Definir variaveis do Rule Engine se rotinas forem usadas.
- [ ] Validar cache/versionamento do service worker no deploy.

## Validacao

- [ ] Testar navegacao de todos os ambientes.
- [ ] Testar pagina de luzes de todos os ambientes.
- [ ] Testar ar-condicionado de todos os ambientes que possuem AC.
- [ ] Testar televisao de todos os ambientes que possuem TV.
- [ ] Testar estado visual dos botoes depois dos comandos reais.
- [ ] Testar em desktop.
- [ ] Testar em tablet.
- [ ] Testar em celular.
